#!/usr/bin/env python3
"""Verify a deployed Shortcuts endpoint with GET and invalid credentials only.
Never takes a real token, never uploads health data, and never prints response bodies.
"""
import argparse
import json
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


class VerificationError(Exception):
    pass


def validate_url(url):
    parsed = urlparse(url)
    if (parsed.scheme != 'https' or parsed.hostname != 'script.google.com'
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.port not in (None, 443)
            or not re.fullmatch(r'/macros/s/[A-Za-z0-9_-]+/exec', parsed.path)):
        raise VerificationError('只接受不含查詢參數的 Google Apps Script /exec HTTPS 網址。')
    return url


class GoogleRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = urlparse(newurl)
        if target.scheme != 'https' or target.hostname not in ('script.google.com', 'script.googleusercontent.com'):
            raise VerificationError('端點重新導向登入頁或其他網站；請確認部署存取設定。')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def probe(opener, url, body=None):
    headers = {'Accept': 'application/json', 'Cache-Control': 'no-store'}
    if body is not None:
        headers['Content-Type'] = 'application/json'
    request = Request(url, data=body, headers=headers, method='POST' if body is not None else 'GET')
    try:
        with opener.open(request, timeout=25) as response:
            if response.status != 200:
                raise VerificationError('端點未回傳預期的 HTTP 200 JSON。')
            raw = response.read(16385)
    except (HTTPError, URLError, TimeoutError):
        raise VerificationError('端點暫時無法連線，或部署仍要求 Google 網頁登入。') from None
    if len(raw) > 16384:
        raise VerificationError('未授權回應超出預期大小，停止驗收。')
    try:
        result = json.loads(raw)
    except (ValueError, UnicodeError):
        raise VerificationError('端點回傳不是 JSON，可能是登入頁或部署錯誤頁。') from None
    if (not isinstance(result, dict) or set(result) != {'ok', 'error'}
            or result.get('ok') is not False or not isinstance(result.get('error'), str)):
        raise VerificationError('未授權請求沒有回傳單純的拒絕結果，停止驗收。')
    return result['error']


def check_endpoint(url, opener=None):
    validate_url(url)
    opener = opener or build_opener(GoogleRedirects())
    probes = [
        ('GET', None, {'METHOD_NOT_ALLOWED'}),
        ('POST_EMPTY', b'{}', {'SERVICE_DISABLED', 'AUTH_FAILED'}),
        ('POST_INVALID_TOKEN', json.dumps({'version': 1, 'deviceId': 'unauthenticated-probe',
                                         'token': 'intentionally-invalid'}).encode(),
         {'SERVICE_DISABLED', 'AUTH_FAILED'}),
    ]
    report = []
    for name, body, expected in probes:
        code = probe(opener, url, body)
        if code not in expected:
            raise VerificationError(name + ' 未回傳預期的未授權錯誤。')
        report.append({'probe': name, 'result': code})
    return {'unauthenticated_probes': report, 'authorized_write_test': 'not_performed',
            'note': '只確認未授權拒絕路徑，不能據此宣告健康資料寫入已通過。'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True, help='Apps Script 公開部署網址，不含 Token')
    args = parser.parse_args()
    try:
        print(json.dumps(check_endpoint(args.url), ensure_ascii=False, indent=2))
        return 0
    except (VerificationError, ValueError):
        # No response body or user-supplied URL is included in errors.
        print('端點未通過未授權驗收；請確認網址、部署存取權限及拒絕回應。', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
