import { analytics } from '@heycatch/sdk';

// HeyCatch analytics. Next runs this file on the client before hydration on
// every page, so init sits at module scope here rather than in a component —
// the SDK no-ops until init runs. The key is publishable, hence inlined.
analytics.init({
  projectKey: 'hck_pk_3bfBWKLGSp84zM3Mua6oFurGChCMe2Jl',
  install: {
    framework: 'nextjs',
    frameworkVersion: '16',
    agent: 'claude-code',
  },
});
