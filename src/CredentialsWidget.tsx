import { Widget } from '@lumino/widgets';
import { Message } from '@lumino/messaging';
import { ServiceManager } from '@jupyterlab/services';
import { ISessionContext } from '@jupyterlab/apputils';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {Provider, useDispatch} from 'react-redux';
import { applyMiddleware, combineReducers, compose, createStore } from 'redux';

import CredentialsList from './CredentialsList';

import credentialsReducer, {ICredential, setCredential} from './ducks/credentials';

import { requestAPI } from './handler';

const json = '';
const data = json.length > 0 ? JSON.parse(json) : {};

const rootReducer = combineReducers({
  credentialsReducer
});

const logger = ({ getState }) => {
  return next => action => {
    const state: string = JSON.stringify(getState());
    console.log("state ", state )
    return next(action);
  };
};

const store = createStore(rootReducer, data, compose(applyMiddleware(logger)));

const saveCredentials = async (credentials: Array<ICredential>) => {
  let credentials_list = credentials.map(x => ({"name": x.tag, "value": x.value}));
  const options: RequestInit = {
    method: 'PUT',
    body: JSON.stringify({
      'credentials': credentials_list
    })
  };
  requestAPI<any>('credentials', options)
    .then(data => {
      console.log(`saveCredentials: ${data}`);
    })
    .catch(reason => {
      console.error(`Error saving credentials.${reason}`);
    });
};

const loadCredentials = async () => {
  const options: RequestInit = {
    method: 'GET'
  };
  requestAPI<any>('credentials', options)
    .then(data => {
      console.log("loadCredentials");
      console.log(data);
      return data;
    })
    .catch(reason => {
      console.error(`Error retrieving saved credentials.${reason}`);
    });
};

const deleteCredential = async (tag: string) => {
  const options: RequestInit = {
    method: 'DELETE',
    body: JSON.stringify({
      tag: tag
    })
  };
  requestAPI<any>('credentials', options)
    .then(data => {
      console.log(`deleteCredential: ${data}`);
    })
    .catch(reason => {
      console.error(`Error saving credentials.${reason}`);
    });
};

export class CredentialsWidget extends Widget {
  private div: HTMLElement;
  private setAddCredentialListener: (listener: () => void) => void;
  private getCredentialList: () => Array<ICredential>;
  private setCredentialsList: (credentials: Array<ICredential>) => void;
  private setLastId: (lastId: number) => void;
  private getLastId: () => number;
  private onSaved: () => void;

  private serviceManager: ServiceManager;
  private clientSession: ISessionContext;
  private mainpath: string;

  constructor(options: CredentialsWidget.IOptions) {
    super();
    this.addClass('jp-CredentialsStore');
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

    this.mainpath = undefined;

    this.load = this.load.bind(this);

    this.save = this.save.bind(this);
    options.setSaveListener(this.save);

    this.removeCredential = this.removeCredential.bind(this);
  }

  setCredentialListGetter(getCredentialList: () => Array<ICredential>) {
    this.getCredentialList = getCredentialList;
  }

  setSetCredentialsListener(
    setCredentialsList: (credentials: Array<ICredential>) => void
  ) {
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

  load() {
    this.render(() => {
        document.getElementById("overlay").style.display = "none";
    });
    const data = loadCredentials();
    this.setCredentialsList(data['credentials']);
    this.setLastId(data['lastId']);
    this.render(() => {});
  }

  save() {
    saveCredentials(this.getCredentialList());
    this.onSaved();
  }

  removeCredential(tag: string) {
    deleteCredential(tag);
  }

  protected onAfterShow(msg: Message): void {
    new Promise<void>((resolve, reject) => {
      this.render(() => {
        resolve();
      });
      this.load();
    });
  }

  render(onRendered: () => any) {
    ReactDOM.render(
      <Provider store={store}>
        <div>
          <div id="overlay">
            <div className="loader"></div>
          </div>
          <CredentialsList
            isConnected={this.clientSession !== undefined}
            setAddCredentialListener={this.setAddCredentialListener}
            setCredentialListGetter={this.setCredentialListGetter}
            setSetCredentialsListener={this.setSetCredentialsListener}
            setSetLastIdListener={this.setSetLastIdListener}
            setLastIdGetter={this.setLastIdGetter}
            setOnSavedListener={this.setOnSavedListener}
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
  }
}
