"""Rebuild the combined offline catalogue from the two bundled source snapshots."""
import copy
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'

def canonical(url):
    parts = urlsplit(url.strip())
    if parts.scheme.lower() not in ('http', 'https', 'ftp') or not parts.netloc:
        raise ValueError(f'Unsupported resource URL: {url}')
    host = parts.netloc.lower().removeprefix('www.')
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
             if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')]
    scheme = 'ftp' if parts.scheme.lower() == 'ftp' else 'https'
    return urlunsplit((scheme, host, parts.path.rstrip('/') or '/', urlencode(sorted(query)), parts.fragment))

def js_file(path, name, data):
    text = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    path.write_text(f'window.{name} = {text};\n', encoding='utf-8')

def build():
    hub = json.loads((PUBLIC / 'hub/data.json').read_text(encoding='utf-8-sig'))
    atlas_text = (PUBLIC / 'atlas/content.js').read_text(encoding='utf-8-sig')
    atlas = json.loads(atlas_text.split('=', 1)[1].strip().removesuffix(';'))
    merged = {}
    for raw in hub['items']:
        key = canonical(raw['url'])
        item = copy.deepcopy(raw)
        item.update(id=hashlib.sha256(key.encode()).hexdigest()[:16], origins=['hub'], sourceIds=[raw['source']], sourceRecords=[raw])
        if key in merged:
            existing = merged[key]
            existing['sourceIds'] = list(dict.fromkeys(existing['sourceIds'] + [raw['source']]))
            existing['tags'] = list(dict.fromkeys(existing.get('tags', []) + raw.get('tags', [])))
            existing['sourceRecords'].append(raw)
        else:
            merged[key] = item
    for raw in atlas['resources']:
        key = canonical(raw['url'])
        if key in merged:
            item = merged[key]
            item['origins'].append('atlas') if 'atlas' not in item['origins'] else None
            item['sourceIds'].append('atlas') if 'atlas' not in item['sourceIds'] else None
        else:
            item = dict(id=hashlib.sha256(key.encode()).hexdigest()[:16], source='atlas', type='database',
                        title=raw['name'], url=raw['url'], excerpt=raw['description'], date='', category=raw['category'],
                        tags=[raw['category']], origins=['atlas'], sourceIds=['atlas'], sourceRecords=[])
            merged[key] = item
        item.setdefault('atlasRecords', []).append(raw)
        item['tags'] = list(dict.fromkeys(item.get('tags', []) + [raw['category']]))
    sources = copy.deepcopy(hub['sources'])
    sources.append(dict(id='atlas', name='ChemDB Atlas', color='#206452', url='../atlas/index.html',
                        role='数据库与研究资源目录', status='snapshot', statusLabel='原项目目录快照', fetchedAt='2026-10-27'))
    items = list(merged.values())
    for source in sources:
        source['itemCount'] = sum(source['id'] in item['sourceIds'] for item in items)
    hub_counts = {s['id']: sum(i['source'] == s['id'] for i in hub['items']) for s in hub['sources']}
    for source in hub['sources']:
        source['itemCount'] = hub_counts[source['id']]
    stats = dict(hubEntries=len(hub['items']), atlasEntries=len(atlas['resources']),
                 uniqueEntries=len(items), duplicates=len(hub['items']) + len(atlas['resources']) - len(items),
                 guideChapters=len(atlas['guides']), sources=len(sources),
                 directoryEntries=sum(i['source'] == 'resdir' or 'atlas' in i['origins'] for i in items))
    data = dict(generatedAt=hub.get('generatedAt'), packagedAt='2026-10-28',
                sources=sources, items=items, stats=stats,
                note='数据为原项目保存的快照，合并未重新核验外部网站；全文与使用许可请查看原站。')
    (PUBLIC / 'merged-data.json').write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
    js_file(PUBLIC / 'merged-data.js', 'CHEMRESEARCH_DATA', data)
    js_file(PUBLIC / 'hub/data.js', 'CHEMVIS_DATA', hub)
    (ROOT / 'merge-report.json').write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(stats, ensure_ascii=False))
    return stats

if __name__ == '__main__':
    build()
