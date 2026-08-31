DATA DIRECTORY
==============

jobs.json     The live vacancy list. Written by the admin panel, read by the
              careers page. This is the only file the public can read.

admin.json    Your admin username and password hash. Created the first time you
              open /admin/. Never readable from the web (.htaccess denies it).

admin-log.txt Login attempts and every change made, with date, IP and action.

backups/      Automatic snapshot of jobs.json before each change. Last 20 kept.


IMPORTANT FOR YOUR HOST
-----------------------
PHP must be able to WRITE to this directory. If saving fails, set permissions:

    chmod 755 data
    chmod 644 data/jobs.json

If the panel still cannot save, use 775 on the directory.

To reset a forgotten admin password: delete admin.json and reopen /admin/,
which will show the account-creation screen again.


APPLICATION REFERENCE FORMAT
============================
Every application and enquiry is given a reference in this form:

    BMC + DD + MM + HH + MM        (Riyadh time)

    BMC31080306   = 31 August, 03:06

If more than one application arrives in the SAME minute, a sequence letter is
added so no two candidates ever share a reference:

    BMC31080306    first
    BMC31080306B   second
    BMC31080306C   third

The first keeps the clean form. Allocation uses an exclusive file lock, so two
simultaneous submissions cannot be given the same code. The ledger that tracks
this is .refs.json inside the application storage directory; it keeps only the
last 500 minutes and needs no maintenance.
