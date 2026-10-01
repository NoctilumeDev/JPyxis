import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import sys
import zipfile
container, ledger, destination = [Path(value).resolve() for value in sys.argv[1:4]]
workspace_build = (Path.cwd() / 'build').resolve()
assert destination.is_relative_to(workspace_build) and destination != workspace_build
assert not destination.exists()
record = json.loads(ledger.read_bytes())
raw = container.read_bytes()
assert len(raw) == record['containerBytes'] and 'sha256:' + hashlib.sha256(raw).hexdigest() == record['sha256']
if os.name == 'nt':
    destination = Path('\\\\?\\' + str(destination))
destination.mkdir(parents=True)
with zipfile.ZipFile(container) as archive:
    assert len(archive.namelist()) == len(set(archive.namelist()))
    assert set(archive.namelist()) == {member['path'] for member in record['members']}
    for member in record['members']:
        name = PurePosixPath(member['path'])
        assert not name.is_absolute() and '..' not in name.parts
        raw = archive.read(member['path'])
        assert len(raw) == member['bytes'] and 'sha256:' + hashlib.sha256(raw).hexdigest() == member['sha256']
        target = destination / member['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
print(json.dumps({'verifiedMembers': len(record['members'])}))
