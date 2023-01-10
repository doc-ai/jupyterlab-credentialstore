import json


async def test_get_example(jp_fetch):
    # When
    response = await jp_fetch("credentialstore", "credentials")

    # Then
    assert response.code == 200
    payload = json.loads(response.body)
    assert payload.get('credentials', None) is not None
