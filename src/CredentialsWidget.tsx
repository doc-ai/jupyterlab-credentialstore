declare var require: any
let CryptoJS = require("crypto-js");

import {
    Widget
} from '@lumino/widgets';

import {Message} from '@lumino/messaging';
import {ServiceManager} from '@jupyterlab/services';
import {SessionContext, ISessionContext} from '@jupyterlab/apputils';
import {Kernel, KernelMessage} from '@jupyterlab/services';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {Provider} from 'react-redux';
import {createStore, combineReducers, compose, applyMiddleware} from 'redux';

import CredentialsList from './CredentialsList'

import {
    ICredential
} from './ducks/credentials'

import credentialsReducer from './ducks/credentials'
import tokenReducer from './ducks/token'

// TODO: this should be connected to the Jupyter-Model / Data
const json = "";
const data = json != null && json.length > 0 ? JSON.parse(json) : {};

const rootReducer = combineReducers({
    credentialsReducer,
    tokenReducer
});

const logger = ({getState}) => {
    return next => action => {
        const returnValue = next(action)

        //const state: string = JSON.stringify(getState());

        return returnValue
    }
}

const store = createStore(
    rootReducer,
    data,
    compose(
        applyMiddleware(
            logger
        ),
    )
);

function encrypt(msgString, token) {
    token = CryptoJS.enc.Utf8.parse(token.substring(0, 16))

    let iv = CryptoJS.lib.WordArray.random(16);
    let encrypted = CryptoJS.AES.encrypt(msgString, token, {
        iv: iv
    });
    return iv.concat(encrypted.ciphertext).toString(CryptoJS.enc.Base64);
}

function decrypt(ciphertextStr, token) {
    token = CryptoJS.enc.Utf8.parse(token.substring(0, 16))

    let ciphertext = CryptoJS.enc.Base64.parse(ciphertextStr);

    // split IV and ciphertext
    let iv = ciphertext.clone();
    iv.sigBytes = 16;
    iv.clamp();
    ciphertext.words.splice(0, 4); // delete 4 words = 16 bytes
    ciphertext.sigBytes -= 16;

    // decryption
    let decrypted = CryptoJS.AES.decrypt({ciphertext: ciphertext}, token, {
        iv: iv
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}

const pyWriteFile = (session, token, lastId, credentials, onStoredCredentials, setToken, mainpath) => {
    
    let enc_credentials = credentials !== undefined ? credentials.map(c => {
        let val = encrypt(c.value, token)
        return {id: c.id, tag: c.tag, value: val, changed: c.changed};
    }) : credentials;

    if (session !== undefined) {
        let kernel_id = session._session.kernel.id;

        let code = `
import pickle, os, json
from pathlib import Path
import base64, os
from Crypto.Cipher import AES

home = str(Path.home())
# PATH = \`+mainpath+\`+'/.credentialstore'
PATH = str(Path.home())+'/.credentialstore'

BLOCK_SIZE = 16
def unpad(data):
    return data[:-data[-1]]

def decrypt(value):
` + (token !== undefined ? `
    value = base64.b64decode(value)
    IV = value[:BLOCK_SIZE]
    aes = AES.new(b'` + token.substring(0, 16) + `', AES.MODE_CBC, IV)
    return unpad(aes.decrypt(value[BLOCK_SIZE:]))
` :
                `
    return value
`
        ) + `
# prepare loading the existing data
json_data_to_write = {"credentials": [], "lastId": 0}
json_data = {"credentials": [], "lastId": 0}

if os.path.isfile(PATH):
    with open(PATH, 'r') as f:
        data = f.read()
        json_data = json.loads(data)
` + (enc_credentials === undefined ? `
json_data_to_write = json_data
for credential in json_data["credentials"]:
    if credential["tag"] is not None and len(credential["tag"]) > 0:`
                + (token !== undefined ? `
        exec("%s = %s" % (credential["tag"],decrypt(credential["value"])))
` : `
        pass
`) + `
        
` : enc_credentials.map(credential => {
                return (credential.tag !== undefined ?
                        (credential.tag + "=decrypt('" + credential.value + "')") : "")
                    + "\n"
                    + 'json_data_to_write["credentials"].append({"id":"'
                    + credential.id + '","tag":"' + (credential.tag !== undefined ? credential.tag : "")
                    + '","value":"' + (credential.value !== undefined ? credential.value : "")
                    + '","changed":False})\n'
            }).reduce((res, val) => res + "\n" + val, "")
        ) + `
json_data_to_write["kernel_id"] = "` + kernel_id + `"
json_data_to_write["lastId"] = max(int(json_data["lastId"]), int(` + lastId + `))
if "token" not in json_data_to_write.keys():
    ` + (token !== undefined ? 'json_data_to_write["token"]="' + CryptoJS.SHA256(token).toString() + '"' : 'pass') + `
with open(PATH, 'w') as f:
    json.dump(json_data_to_write, f);
`;
        
        let userExpressions = {'output': 'json.dumps(json_data)'}
        let content: KernelMessage.IExecuteRequestMsg['content'] = {
            code: code,
            stop_on_error: true,
            user_expressions: userExpressions
        };

        let future = session._session.kernel.requestExecute(content, false, {});


        future.done.then(msg => {
            //try {
            let raw_data = msg['content']['user_expressions']['output']['data']['text/plain'];

            let data = JSON.parse(
                raw_data.replace(/^\'+|\'+$/g, '')
            );

            setToken(data.token);

            if (onStoredCredentials !== undefined && token !== undefined) {
                let dec_credentials = data.credentials.map(c => {
                    let val = decrypt(c.value, token);

                    return {
                        id: c.id,
                        tag: c.tag,
                        value: val,
                        changed: c.changed
                    };
                });

                onStoredCredentials(data.lastId, dec_credentials);
            }
            /*  
            } catch (err) {
            }*/
        });
    }
}

export class CredentialsWidget extends Widget {
    private div: HTMLElement;
    private setAddCredentialListener: (listener: () => void) => void;
    private getCredentialList: () => Array<ICredential>;
    private setCredentialsList: (credentials: Array<ICredential>) => void;
    private setLastId: (lastId: number) => void;
    private getLastId: () => number;
    private onSaved: () => void;
    private onStop: () => void;

    private token: string;
    private unencrypted_token: string;

    private serviceManager: ServiceManager;
    private clientSession: ISessionContext;
    private mainpath: string;

    constructor(options: CredentialsWidget.IOptions) {
        super();
        this.addClass("jp-CredentialsStore");
        this.div = document.createElement('div');
        this.div.id = 'rootContent';
        this.div.setAttribute('tabindex', '1');
        this.node.appendChild(this.div);

        this.serviceManager = options.serviceManager;

        this.setAddCredentialListener = options.setAddCredentialListener;
        this.setCredentialListGetter = this.setCredentialListGetter.bind(this);
        this.setSetCredentialsListener = this.setSetCredentialsListener.bind(this);
        this.setLastIdGetter = this.setLastIdGetter.bind(this);
        this.setSetLastIdListener = this.setSetLastIdListener.bind(this);
        this.setOnSavedListener = this.setOnSavedListener.bind(this);
        this.setOnStopListener = this.setOnStopListener.bind(this);
        this.onTokenSet = this.onTokenSet.bind(this);

        this.token = undefined;
        this.mainpath = undefined;

        this.login = this.login.bind(this);
        options.setLoginListener(this.login);

        this.load = this.load.bind(this);
        this.setToken = this.setToken.bind(this);

        this.stop = this.stop.bind(this);
        options.setStopListener(this.stop);

        this.save = this.save.bind(this);
        options.setSaveListener(this.save);

        this.removeCredential = this.removeCredential.bind(this);

        this.clientSession = new SessionContext({
            sessionManager: this.serviceManager.sessions,
            specsManager: this.serviceManager.kernelspecs,
            kernelPreference: {
                name: "python3",
                shouldStart: true,
                canStart: true,
                autoStartDefault: true
            }
        });

        this.clientSession.initialize().then(() => {
            let kernel_id = this.clientSession.session.kernel.id;
            let code = `import os, sys
from pathlib import Path
from sys import path

os.chdir(str(Path.home()))
curwd = os.getcwd()
PATH = str(Path.home())+'/.jupyter-credentialstore'
os.makedirs(PATH, exist_ok=True)

to_add=Path(PATH)

if str(to_add) not in path:
    minLen=999999
    for index,directory in enumerate(path):
        if 'site-packages' in directory and len(directory)<=minLen:
            minLen=len(directory)
            stpi=index

    pathSitePckgs=Path(path[stpi])
    with open(str(pathSitePckgs/'current_machine_paths.pth'),'w') as pth_file:
        pth_file.write(str(to_add))




with open(PATH+"/kernel_connector.py", 'w') as f:
    f.write("""
import json, os
import jupyter_client
import pickle

PATH = '"""+curwd+"""/.credentialstore'

def get_kernel_id():
    # get the kernel data
    with open(PATH, 'r') as f:
        data = f.read()
        json_data = json.loads(data)
        return json_data["kernel_id"]

def get_credential(tag):
    cf=jupyter_client.find_connection_file(get_kernel_id())
    km=jupyter_client.BlockingKernelClient(connection_file=cf)
    km.load_connection_file()

    km.start_channels()
    msgid = km.execute("", user_expressions={'output':'pickle.dumps('+tag+')'})
    reply = km.get_shell_msg(timeout=5)
    #print(reply)
    try:
        output_bytes = reply['content']['user_expressions']['output']['data']['text/plain']
        return pickle.loads(eval(output_bytes)).decode("utf-8")
    
    except:
        return None

""")
`
            let userExpressions = {'output': 'os.getcwd()'}
            let content: KernelMessage.IExecuteRequestMsg['content'] = {
                code: code,
                stop_on_error: true,
                user_expressions: userExpressions
            };

            let future = this.clientSession.session.kernel.requestExecute(content, false, {});

            future.done.then(msg => {
                this.mainpath = msg['content']['user_expressions']['output']['data']['text/plain'];
                this.clientSession.shutdown();
                this.clientSession = undefined;
            });
        });
    }

    setCredentialListGetter(getCredentialList: () => Array<ICredential>) {
        this.getCredentialList = getCredentialList;
    }

    setSetCredentialsListener(setCredentialsList: (credentials: Array<ICredential>) => void) {
        this.setCredentialsList = setCredentialsList;
    }

    setLastIdGetter(getLastId: () => number) {
        this.getLastId = getLastId;
    }

    setSetLastIdListener(setLastId: (lastId: number) => void) {
        this.setLastId = setLastId;
    }

    setOnSavedListener(onSaved: () => void) {
        this.onSaved = onSaved;
    }

    setOnStopListener(onStop: () => void) {
        this.onStop = onStop;
    }

    onTokenSet(token: string) {
        this.unencrypted_token = token;
        this.load(token);
        this.render(() => {
        });
    }

    setToken(token: string) {
        this.token = token;
        this.render(() => {
            document.getElementById("overlay").style.display = "none";
        });
    }

    login() {
        document.getElementById("overlay").style.display = "block";

        this.stop();

        this.clientSession = new SessionContext({
            sessionManager: this.serviceManager.sessions,
            specsManager: this.serviceManager.kernelspecs,
            kernelPreference: {
                name: "python3",
                shouldStart: true,
                canStart: true,
                autoStartDefault: true
            }
        });

        this.clientSession.initialize().then(() => {
            this.load(this.unencrypted_token);
        });
    }

    load(token: string) {
        pyWriteFile(
            this.clientSession,
            token,
            this.getLastId(),
            undefined,
            (lastId, credentials) => {
                this.setCredentialsList(credentials);
                this.setLastId(lastId);
            },
            this.setToken,
            this.mainpath
        );
    }

    stop() {
        this.unencrypted_token = undefined;
        this.token = undefined;

        this.onStop();

        if (this.clientSession !== undefined) {
            this.clientSession.shutdown();
            this.clientSession = undefined;

            this.render(() => {
                //;
            });
        }
    }

    save() {
        pyWriteFile(
            this.clientSession,
            this.unencrypted_token,
            this.getLastId(),
            this.getCredentialList(),
            undefined,
            this.setToken,
            this.mainpath
        );

        this.onSaved();
    }

    removeCredential(tag: string) {
        
        if (this.clientSession !== undefined) {
            let kernel_id = this.clientSession.session.kernel.id;
            let code = `exec("%s = None" % ("` + tag + `"))`;
            let content: KernelMessage.IExecuteRequestMsg['content'] = {
                code: code,
                stop_on_error: true
            };

            let future = this.clientSession.session.kernel.requestExecute(content, false, {});
            future.done.then(msg => {
                //
            });
        }
    }


    protected onAfterShow(msg: Message): void {
        new Promise<void>((resolve, reject) => {
            this.render(() => {
                resolve()
            })
        });
    }

    render(onRendered: () => any) {
        ReactDOM.render(<Provider store={store}>
                <div>
                    <div id="overlay">
                        <div className="loader"></div>
                    </div>
                    <CredentialsList
                        argtoken={this.token}
                        isConnected={this.clientSession !== undefined}
                        setAddCredentialListener={this.setAddCredentialListener}
                        setCredentialListGetter={this.setCredentialListGetter}
                        setSetCredentialsListener={this.setSetCredentialsListener}
                        setSetLastIdListener={this.setSetLastIdListener}
                        setLastIdGetter={this.setLastIdGetter}
                        setOnSavedListener={this.setOnSavedListener}
                        onTokenSet={this.onTokenSet}
                        setOnStopListener={this.setOnStopListener}
                        onRemoveCredential={this.removeCredential}
                    />
                </div>
            </Provider>,
            document.getElementById('rootContent'),
            onRendered
        );
    }
}


// The namespace for the `CredentialsWidget` class statics.
export namespace CredentialsWidget {

    export interface IOptions {
        // provides access to service, like sessions
        serviceManager: ServiceManager;

        // function called when the user saves the credentials
        setSaveListener: (listener: () => void) => void;

        //function called when the user adds a credential
        setAddCredentialListener: (listener: () => void) => void;

        //function called when the user clicks the login button
        setLoginListener: (listener: () => void) => void;

        //function called when the user clicks the stop button
        setStopListener: (listener: () => void) => void;
    }
}

