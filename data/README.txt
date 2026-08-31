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
