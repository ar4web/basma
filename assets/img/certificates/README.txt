CERTIFICATES — PLACEHOLDER FILES
================================

Every .jpg in this folder is a MOCK generated for layout purposes.
Each carries a diagonal SPECIMEN watermark and a footer reading
"PLACEHOLDER DOCUMENT — REPLACE WITH SCANNED ORIGINAL BEFORE LAUNCH".

REPLACING THEM
--------------
For each certificate, overwrite two files, keeping the exact filenames:

  cert-commercial-registration.jpg        full size, A4 portrait
  cert-commercial-registration-thumb.jpg  440 x 622

  cert-mhrsd-license.jpg        + -thumb.jpg
  cert-chamber-commerce.jpg     + -thumb.jpg
  cert-gosi.jpg                 + -thumb.jpg
  cert-vat.jpg                  + -thumb.jpg
  cert-saudization.jpg          + -thumb.jpg

Scan settings: A4 portrait, 150 DPI, JPEG quality 80-85.
That gives roughly 1240 x 1754 px and 120-250 KB per file.
Anything above 400 KB should be compressed further.

Keeping the same filenames means NO HTML has to change.

BEFORE YOU UPLOAD
-----------------
Redact anything you do not want public. Scanned Saudi certificates often
carry a QR code or verification number that lets anyone pull the full
record. Cover those areas if you are unsure.

AFTER REPLACING
---------------
1. Delete the amber placeholder notice in index.html. Search for:
      cert-placeholder-note
   Remove that whole <div> block (the HTML comment above it says so too).
2. Bump the ?v=18 cache string in index.html so visitors get fresh files.

REMOVING A CERTIFICATE
----------------------
If you do not hold one of these, delete its <div class="col-lg-2 ..."> block
in the certificates section of index.html and delete the two image files.
Five or four cards still lay out correctly.
