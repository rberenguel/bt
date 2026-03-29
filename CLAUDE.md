# BT — Claude Notes

## Haptics

For fuck's sake I have told you 15 times, triggerHaptic only works on fucking click handlers, it can't work on pointerdown or pointer up. It needs to happen early, too.

## Cache versioning

The `CACHE_NAME` version in `sw.js` MUST always match the `version` field in `manifest.json`. Never change one without changing the other.
