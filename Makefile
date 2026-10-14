APP_URL ?= https://remember-this.io
XCODE_TEAM ?=

.PHONY: ext-build ext-xcode ext-archive-xcode
ext-build:
	APP_URL="$(APP_URL)" npm run build:extension
	cd dist && zip -r remember-this-chrome.zip . -x '*.zip'

ext-xcode:
	APP_URL="$(APP_URL)" npm run build:extension

ext-archive-xcode: ext-xcode
	xcodebuild -project "safari/Remember This.xcodeproj" -scheme "Remember This" -configuration Release -destination 'generic/platform=macOS' -archivePath "$(CURDIR)/build/Remember This.xcarchive" $(if $(XCODE_TEAM),DEVELOPMENT_TEAM=$(XCODE_TEAM)) archive
