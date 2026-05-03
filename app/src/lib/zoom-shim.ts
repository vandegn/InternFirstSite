// Zoom Meeting SDK reads React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner
// which was removed in React 19. This shim restores it so the SDK doesn't crash.
import React from 'react';

const internals = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
if (!internals) {
  (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
    ReactCurrentOwner: { current: null },
  };
} else if (!internals.ReactCurrentOwner) {
  internals.ReactCurrentOwner = { current: null };
}
