import json
import requests

from toniq.secrets import Secrets

PREFIX = "credstore-"


def get_credential(tag):
    session = requests.Session()
    principal = session.cookies.get("toniq-principal", None)
    secret_dict = _get_user_secret(principal)
    if tag in secret_dict:
        return secret_dict[tag]
    raise KeyError("Credential not found")


def _get_user_secret(principal: str):
    secretsmgr = Secrets(gcp_project_id="toniq-dev-dev-1d3b")
    user_secrets = secretsmgr.get_secret(PREFIX + principal, as_json=True)
    secret_dict = {}
    if user_secrets is not None:
        secret_dict = json.dumps(user_secrets)
    return secret_dict
