# 32 — Works on weak signal

**What to build:** The app stays usable in a mill with weak or no
signal. The app opens even when offline, shows the jobs it last loaded
(clearly marked "Offline — last updated 10:42"), and a count or stage
change made offline is saved on the phone and sent once the signal
comes back.

**Blocked by:** —

**Status:** todo

**Size warning:** this is the biggest ticket on the list. Two people
changing the same job offline can clash, and the app has to decide whose
change wins. Consider doing only the first part (open and read offline)
first.

## Checklist

### Part 1: read offline
- [ ] The app can be installed on a phone's home screen and opens with
      no signal
- [ ] My jobs and the jobs list show the last loaded data with an
      "Offline" banner and the time it was last updated
- [ ] Buttons that change data are switched off while offline, with a
      plain message

### Part 2: change offline
- [ ] Stage changes and counts made offline wait in a queue on the phone
      and are sent when the signal returns
- [ ] If the job changed in the meantime, staff are shown both versions
      and choose; nothing is overwritten silently
- [ ] The database rules (RLS and guards) still check every change when
      it arrives

- [ ] Works on the live URL, on a phone in airplane mode

## Not in this ticket

- Signing in for the first time while offline
