"""Shared yfinance HTTP session.

yfinance >=1.x requires a curl_cffi session, not a stdlib requests.Session --
it validates the session's type internally and raises YFDataException for
anything else (confirmed against the installed version's source). curl_cffi's
impersonate="chrome" mode presents a real Chrome-on-Mac User-Agent plus the
matching client-hint headers and TLS fingerprint, which is a more coherent
anti-rate-limit signal than setting a bare User-Agent header would be.

One shared session is reused across every call so yfinance's cookie/crumb
negotiation is cached rather than repeated per ticker -- also the natural
place to add a proxy later if Render's datacenter IP range turns out to be
blocked at the network level regardless of headers/fingerprint.
"""

from curl_cffi import requests as curl_requests

YF_SESSION = curl_requests.Session(impersonate="chrome")
