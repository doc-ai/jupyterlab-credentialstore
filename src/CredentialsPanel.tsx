import { PanelLayout, Widget } from '@lumino/widgets';

import { Toolbar, ToolbarButton } from '@jupyterlab/apputils';

import { ServiceManager } from '@jupyterlab/services';
import { CredentialsWidget } from './CredentialsWidget';

// The class name added to the extension, this class ensures the background to be white
const CLASS_NAME = 'jp-FileBrowser';

export class CredentialsPanel extends Widget {
  private toolbar: Toolbar<Widget>;
  readonly serviceManager: ServiceManager;
  readonly id: string;
  public onAddCredential: () => void;
  public onSave: () => void;

  constructor(options: CredentialsPanel.IOptions) {
    super();

    this.serviceManager = options.serviceManager;
    this.id = options.id;

    this.addClass(CLASS_NAME);

    this.setSaveListener = this.setSaveListener.bind(this);
    const saveButton = new ToolbarButton({
      iconClass: 'jp-SaveIcon jp-Icon jp-Icon-16',
      tooltip: 'Save',
      onClick: () => this.onSave()
    });

    this.setAddCredentialListener = this.setAddCredentialListener.bind(this);
    const newCredential = new ToolbarButton({
      iconClass: 'jp-AddIcon jp-Icon jp-Icon-16',
      tooltip: 'New Credential',
      onClick: () => this.onAddCredential()
    });

    const layout = new PanelLayout();

    this.toolbar = new Toolbar<Widget>();
    this.toolbar.addItem('newCredential', newCredential);
    this.toolbar.addItem('saveButton', saveButton);
    layout.insertWidget(0, this.toolbar);

    layout.addWidget(this.toolbar);

    layout.addWidget(
      new CredentialsWidget({
        serviceManager: options.serviceManager,
        setSaveListener: this.setSaveListener,
        setAddCredentialListener: this.setAddCredentialListener
      })
    );

    this.layout = layout;
  }

  setAddCredentialListener(onAddCredential: () => void) {
    this.onAddCredential = onAddCredential;
  }

  setSaveListener(onSave: () => void) {
    this.onSave = onSave;
  }
}

// The namespace for the `CredentialsPanel` class statics.
export namespace CredentialsPanel {
  export interface IOptions {
    // The widget/DOM id of the credential-panel.
    id: string;

    // provides access to service, like sessions
    serviceManager: ServiceManager;
  }
}
