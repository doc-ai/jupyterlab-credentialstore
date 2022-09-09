# The JupyterLab Credential Store

This JupyterLab extension securely keeps your credentials and provides convenient access.

![](assets/teaser.png)

The **JupyterLab Credential Store** keeps your credentials secure using an AES-encryption. Add, edit, and delete credentials as key-value pairs in this JupyterLab frontend extension. Access the credentials with their keys: 

<table class="image">
<tr><td><img src="assets/sidebar.png" width="400"></td></tr>
<tr><td class="caption" >The Credential Store</td></tr>
</table>

```python
import kernel_connector as kc
kc.get_credential("my_secret")
```

## Prerequisites

* JupyterLab
* NodeJs (`apt-get install nodejs -y`)
* NPM (`apt-get install npm -y`)
* PyCrypto (`pip install pycrypto`)

## Installation

Install the **JupyterLab Credential Store**:

```bash
# Install OS dependencies
Linux:
  apt-get install nodejs -y
  apt-get install npm -y
MacOS:
  brew install nodejs npm
  
# Make a python 3.9 virtual environment
python3 -m venv venv39

# Activate the venv
source venv39/bin/activate

# Install Jupyter
pip install jupyterlab

# Install dependency for credentialstore
Linux:
  pip install pycrypto
MacOS:
  env "CFLAGS=-I/usr/local/include -L/usr/local/lib" pip install pycrypto

# Install this extension
npm config set registry https://nexus.admin.sharecare.com/repository/npm-repo/
npm login (interactive - enter Nexus username and password)
jupyter labextension install @docai/credentialstore 

OR

git clone git@github.com:doc-ai/jupyterlab-credentialstore.git
jupyter labextension install jupyterlab-credentialstore

# Fire up Jupyter
jupyter-lab
```

If you prefer a containerized configuration, the **JupyterLab Credential Store** seamlessly integrates with the [JupyterLab-Configurator](https://lean-data-science.com/#/configure-jupyterlab) (presented [here](https://towardsdatascience.com/how-to-setup-your-jupyterlab-project-environment-74909dade29b)) that lets you easily create your **JupyterLab configuration**. 
