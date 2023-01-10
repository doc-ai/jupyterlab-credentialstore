import * as React from 'react';
import * as Redux from 'redux';
import { connect } from 'react-redux';
import { Action } from 'redux';

import '../style/index.css';

import {
  ICredential,
  getCredentials,
  addCredential,
  removeCredential,
  setCredential,
  getLastId,
  setLastId
} from './ducks/credentials';

interface StateProps {
  credentials: Array<ICredential>;
  lastId: number;
}

interface DispatchProps {
  addCredential: () => void;
  removeCredential: (id: string) => void;
  setCredential: (
    id: string,
    tag: string,
    value: string,
    changed: boolean
  ) => void;
  setLastId: (lastid: number) => void;
}

interface ArgProps {
  isConnected: boolean;
  setAddCredentialListener: (listener: () => void) => void;
  setSetCredentialsListener: (
    listener: (credentials: Array<ICredential>) => void
  ) => void;
  setCredentialListGetter: (
    getCredentialList: () => Array<ICredential>
  ) => void;
  setSetLastIdListener: (listener: (lastId: number) => void) => void;
  setLastIdGetter: (getLastId: () => number) => void;
  setOnSavedListener: (onSaved: () => void) => void;
  onRemoveCredential: (tag: string) => void;
}

type Props = StateProps & DispatchProps & ArgProps;

const CredentialsList: React.FC<Props> = props => {
  props.setAddCredentialListener(props.addCredential);
  props.setCredentialListGetter(() => props.credentials);
  props.setSetCredentialsListener((credentials: Array<ICredential>) => {
    for (const key in Object.entries(credentials)) {
      props.setCredential(
        credentials[key].id,
        credentials[key].tag,
        credentials[key].value,
        false
      );
    }
  });

  props.setSetLastIdListener((lastId: number) => {
    if (lastId !== undefined) {
      props.setLastId(lastId);
    }
  });
  props.setLastIdGetter(() => props.lastId);

  props.setOnSavedListener(() => {
    for (const key in Object.keys(props.credentials)) {
      const credential = props.credentials[key];
      props.setCredential(
        credential.id,
        credential.tag,
        credential.value,
        false
      );
    }
  });

  return (
    <table className="jp-CredentialsTable">
      <tbody>
        <tr>
          <th></th>
          <th>Key</th>
          <th>Value</th>
          <th className="jp-Column"></th>
        </tr>
        {props.credentials.map(credential => (
          <tr>
            <td className="jp-StarColumn">{credential.changed ? '*' : ''}</td>
            <td className="jp-Cell">
              <input
                className={'jp-Input'}
                type="text"
                value={credential.tag !== undefined ? credential.tag : ''}
                onChange={event =>
                  props.setCredential(
                    credential.id,
                    event.target.value,
                    credential.value,
                    true
                  )
                }
              />
            </td>
            <td className="jp-Cell">
              <input
                className="jp-Input"
                type="text"
                value={credential.value !== undefined ? credential.value : ''}
                onChange={event =>
                  props.setCredential(
                    credential.id,
                    credential.tag,
                    event.target.value,
                    true
                  )
                }
              />
            </td>
            <td className="jp-Column">
              <button
                className="jp-Button"
                onClick={() => {
                  props.removeCredential(credential.id);
                  props.onRemoveCredential(credential.tag);
                }}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}{' '}
      </tbody>
    </table>
  );
};

function mapStateToProps(state: any, ownProps?: ArgProps): StateProps {
  return {
    credentials: getCredentials(state),
    lastId: getLastId(state)
  };
}

function mapDispatchToProps(
  dispatch: Redux.Dispatch<Action<any>>,
  ownProps?: ArgProps
): DispatchProps {
  return {
    addCredential: () => {
      dispatch(addCredential());
    },
    removeCredential: (id: string) => {
      dispatch(removeCredential(id));
    },
    setCredential: (
      id: string,
      tag: string,
      value: string,
      changed: boolean
    ) => {
      dispatch(setCredential(id, tag, value, changed));
    },
    setLastId: (lastid: number) => {
      dispatch(setLastId(lastid));
    }
  };
}

export default connect<StateProps, DispatchProps, ArgProps>(
  mapStateToProps,
  mapDispatchToProps
)(CredentialsList);
