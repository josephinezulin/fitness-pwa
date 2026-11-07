import io
import unittest
from urllib.request import Request
from check_ingest_endpoint import GoogleRedirects, VerificationError, check_endpoint, probe, validate_url

URL = 'https://script.google.com/macros/s/test-deployment/exec'


class Response(io.BytesIO):
    status = 200


class Opener:
    def __init__(self, results):
        self.results = iter(results)
        self.requests = []

    def open(self, request, timeout):
        self.requests.append(request)
        return Response(next(self.results))


class EndpointVerificationTests(unittest.TestCase):
    def test_rejects_tokens_in_urls_and_non_google_hosts(self):
        for url in [URL + '?token=secret', URL + '#secret', 'http://script.google.com/macros/s/x/exec',
                    'https://script.google.com.evil.example/macros/s/x/exec',
                    'https://user:pass@script.google.com/macros/s/x/exec']:
            with self.assertRaises(VerificationError):
                validate_url(url)
        self.assertEqual(validate_url(URL), URL)

    def test_confirms_disabled_endpoint_without_uploading_health_data(self):
        opener = Opener([b'{"ok":false,"error":"METHOD_NOT_ALLOWED"}',
                         b'{"ok":false,"error":"SERVICE_DISABLED"}',
                         b'{"ok":false,"error":"SERVICE_DISABLED"}'])
        report = check_endpoint(URL, opener)
        self.assertEqual(report['authorized_write_test'], 'not_performed')
        self.assertEqual(report['unauthenticated_mode'], 'service_disabled')
        self.assertEqual([r.method for r in opener.requests], ['GET', 'POST', 'POST'])
        for request in opener.requests:
            self.assertNotIn('Authorization', request.headers)
            self.assertNotIn('metrics', (request.data or b'').decode())

    def test_distinguishes_auth_rejection_from_a_disabled_service(self):
        opener = Opener([b'{"ok":false,"error":"METHOD_NOT_ALLOWED"}',
                         b'{"ok":false,"error":"AUTH_FAILED"}',
                         b'{"ok":false,"error":"AUTH_FAILED"}'])
        report = check_endpoint(URL, opener)
        self.assertEqual(report['unauthenticated_mode'], 'auth_rejected')
        self.assertEqual(report['authorized_write_test'], 'not_performed')

    def test_does_not_accept_inconsistent_or_changing_post_auth_responses(self):
        opener = Opener([b'{"ok":false,"error":"METHOD_NOT_ALLOWED"}',
                         b'{"ok":false,"error":"SERVICE_DISABLED"}',
                         b'{"ok":false,"error":"AUTH_FAILED"}'])
        with self.assertRaises(VerificationError):
            check_endpoint(URL, opener)

    def test_rejects_success_for_an_unauthenticated_request(self):
        with self.assertRaises(VerificationError):
            probe(Opener([b'{"ok":true}']), URL)

    def test_rejects_health_content_even_if_response_claims_auth_failure(self):
        with self.assertRaises(VerificationError):
            probe(Opener([b'{"ok":false,"error":"AUTH_FAILED","metrics":[68.5]}']), URL)

    def test_rejects_html_and_oversized_responses_without_printing_the_body(self):
        for body in [b'<html>Google login</html>', b'x' * 16385]:
            with self.assertRaises(VerificationError):
                probe(Opener([body]), URL)

    def test_redirects_cannot_lead_to_login_or_non_google_sites(self):
        redirects = GoogleRedirects()
        for target in ['https://accounts.google.com/login', 'https://evil.example/', 'http://script.googleusercontent.com/x',
                       'https://user:pass@script.googleusercontent.com/x', 'https://script.googleusercontent.com:4443/x']:
            with self.assertRaises(VerificationError):
                redirects.redirect_request(Request(URL), None, 302, '', {}, target)


if __name__ == '__main__':
    unittest.main()
