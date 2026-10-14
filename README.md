<img src="public/icons/icon-128.png" alt="Remember This app icon" width="128" height="128">

# Remember This browser extension

The browser extension for [remember-this](https://remember-this.io). Save text, links, images, screenshots, and files, and recall your saved memories from your browser.

To build locally:

```sh
npm ci
npm run build
```

Load the `dist` folder as an unpacked extension in Chrome or Edge. The build connects to `http://localhost:8000` by default; set `APP_URL` to use another instance.

To create a macOS Safari archive with Xcode installed:

```sh
make ext-archive-xcode
```

This builds against `https://remember-this.io` by default and archives the Safari app to `build/Remember This.xcarchive`. Open the archive in Xcode to distribute it. Override `APP_URL` for another instance.

The Safari project lives in `safari/Remember This.xcodeproj`. Run `make ext-xcode` to build its extension assets, then open the project and select your team under **Signing & Capabilities** for both targets before the first archive. You can optionally override the team with `XCODE_TEAM=YOUR_APPLE_TEAM_ID`.

If the build fails with a missing Vite module, run `npm ci` to reinstall dependencies from the lockfile.

For Xcode Cloud, use project `safari/Remember This.xcodeproj` and scheme `Remember This`. The post-clone script installs Node if needed and builds the extension assets from the lockfile. Set `APP_URL` in the workflow environment to override the production URL. Generated files in `dist/` and `build/` stay out of Git.
