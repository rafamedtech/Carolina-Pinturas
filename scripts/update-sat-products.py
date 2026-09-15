"""Refresh the versioned Siigo Mexico SAT catalogs. Python 3, standard library only.
Usage: python3 scripts/update-sat-products.py [--source-dir /tmp]
The optional directory must contain siigo-unidades-sat.xlsm and siigo-claves.xlsx.
"""
import argparse
import datetime
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

BASE = 'https://saprodcentralassets.blob.core.windows.net/siigoapi/documentation/'
SOURCES = {
    'unit': ('siigo-unidades-sat.xlsm', BASE + 'Unidades%20de%20medida%20SAT.xlsm'),
    'key': ('siigo-claves.xlsx', BASE + 'Claves%20de%20Productos-Servicios%20SAT.xlsx'),
}
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def rows(data):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
            strings = [''.join(el.itertext()) for el in root]
        sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
        result = []
        for row in sheet.findall('.//s:row', NS)[1:]:
            values = []
            for cell in row.findall('s:c', NS)[:2]:
                value = cell.findtext('s:v', '', NS)
                if cell.get('t') == 's':
                    value = strings[int(value)]
                elif cell.get('t') == 'inlineStr':
                    value = ''.join(cell.find('s:is', NS).itertext())
                values.append(value.strip())
            if len(values) == 2 and all(values):
                result.append({'code': values[0], 'name': values[1]})
        return sorted(result, key=lambda item: item['code'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path)
    args = parser.parse_args()
    result = {'retrievedAt': datetime.datetime.now(datetime.timezone.utc).date().isoformat(),
              'publisher': 'Siigo México', 'catalogs': {}}
    for kind, (filename, url) in SOURCES.items():
        data = ((args.source_dir / filename).read_bytes() if args.source_dir
                else urllib.request.urlopen(url, timeout=60).read())
        entries = rows(data)
        if len(entries) < (1000 if kind == 'unit' else 50000):
            raise ValueError('Catálogo incompleto: ' + kind)
        if len({entry['code'] for entry in entries}) != len(entries):
            raise ValueError('Códigos duplicados: ' + kind)
        result['catalogs'][kind] = {'source': url, 'sha256': hashlib.sha256(data).hexdigest(), 'entries': entries}
    target = Path(__file__).resolve().parents[1] / 'server/assets/sat/catalog.json'
    target.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    print({kind: len(cat['entries']) for kind, cat in result['catalogs'].items()})


if __name__ == '__main__':
    main()
