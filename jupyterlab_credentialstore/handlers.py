import json
import tornado.web

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

from toniq.secrets import Secrets
from tornado.escape import json_decode

from .credentialstore import _get_user_secret, PREFIX


class CredentialHandler(APIHandler):

    def __init__(self, application, request, **kwargs):
        super().__init__(application, request, **kwargs)

        self.toniq_principal = self.request.cookies.get('toniq-tp', None)
        self.secretsmgr = Secrets(gcp_project_id="toniq-dev-dev-1d3b")

    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        try:
            user_secret = _get_user_secret(self.toniq_principal.value)
            self.finish(json.dumps({
                "credentials": user_secret
            }))
        except Exception as err:
            self.send_error(500, reason=f'Error retrieving credentials: {err}')

    @tornado.web.authenticated
    def put(self):
        try:
            data = json_decode(self.request.body)
            creds = data['credentials']
            # save creds as secrets for this user
            response = self.secretsmgr.save_secret(PREFIX + self.toniq_principal.value, json.dumps(creds), as_json=True)
            self.finish(json.dumps({
                "response": response
            }))
        except Exception as err:
            self.send_error(500, reason=f'Error saving credentials: {err}')

    @tornado.web.authenticated
    def delete(self):
        try:
            data = json_decode(self.request.body)
            deletion_key = data['tag']
            # delete cred for this user
            user_secret = _get_user_secret(self.toniq_principal.value)
            # delete the specified hey from the user secrets json object
            secret_dict = json.loads(user_secret)
            del secret_dict['credentials'][deletion_key]
            self.secretsmgr.save_secret(PREFIX + self.toniq_principal.value, json.dumps(user_secret), as_json=True)
            self.finish(json.dumps({
                "credentials": json.loads(user_secret)
            }))
        except Exception as err:
            self.send_error(500, reason=f'Error deleting credentials: {err}')


def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "credentialstore", "credentials")
    handlers = [(route_pattern, CredentialHandler)]
    web_app.add_handlers(host_pattern, handlers)
