"""Verify byte containers without trusting emitted semantic PASS/FAIL labels."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import zipfile

results = []
for namespace, filename in [('local-observations', 'original-raw.zip'), ('public-candidates', 'original-incomplete-bundle.zip')]:
    root = Path('evidence/reference-path/v1') / namespace
    for retention in sorted(root.glob('*/retention.json')):
        record = json.loads(retention.read_bytes())
        container = retention.parent / filename
        raw = container.read_bytes()
        assert len(raw) == record['containerBytes']
        assert 'sha256:' + hashlib.sha256(raw).hexdigest() == record['sha256']
        with zipfile.ZipFile(container) as archive:
            assert len(archive.namelist()) == len(set(archive.namelist()))
            assert set(archive.namelist()) == {member['path'] for member in record['members']}
            for member in record['members']:
                name = PurePosixPath(member['path'])
                assert not name.is_absolute() and '..' not in name.parts
                payload = archive.read(member['path'])
                assert len(payload) == member['bytes']
                assert 'sha256:' + hashlib.sha256(payload).hexdigest() == member['sha256']
        results.append({'archive': container.as_posix(), 'members': len(record['members']), 'sha256': record['sha256']})
assert len(results) >= 2
print(json.dumps({'verdict': 'PASS', 'scope': 'Raw container and member bytes only; semantic qualification is independently derived', 'results': results}))
