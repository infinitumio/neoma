// SPDX-License-Identifier: AGPL-3.0-or-later
// `tauri ios init` regenerates src-tauri/gen/apple with a stock main.mm. This
// re-applies our native tweak: hide the WKWebView keyboard input-accessory bar
// (prev/next/Done), which otherwise resizes the layout when the editor is
// focused. There is no web API for this. Runs after `npm run ios:init`.
import { readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const mainMm = path.join(root, 'src-tauri', 'gen', 'apple', 'Sources', 'neoma', 'main.mm')

const SNIPPET = `#import <UIKit/UIKit.h>
#import <objc/runtime.h>

// Remove the keyboard input-accessory bar (the prev/next/Done toolbar) that
// WKWebView shows above the keyboard. It resizes the layout when the editor is
// focused (the "everything moves up" bug) and there is no web API to hide it,
// so override the private WKContentView's inputAccessoryView to return nil.
static void neoma_hide_input_accessory(void) {
	Class cls = NSClassFromString(@"WKContentView");
	if (cls == nil) {
		return;
	}
	IMP imp = imp_implementationWithBlock(^UIView *(id _self) { return nil; });
	SEL sel = @selector(inputAccessoryView);
	Method existing = class_getInstanceMethod(cls, sel);
	if (existing != NULL) {
		method_setImplementation(existing, imp);
	} else {
		class_addMethod(cls, sel, imp, "@@:");
	}
}
`

try {
  await access(mainMm)
} catch {
  console.log('patch-ios-webview: no iOS project yet — skipping')
  process.exit(0)
}

let src = await readFile(mainMm, 'utf8')
if (src.includes('neoma_hide_input_accessory')) {
  console.log('patch-ios-webview: already patched')
  process.exit(0)
}

// Insert the snippet after the bindings include, and call it before start_app.
src = src.replace('#include "bindings/bindings.h"\n', `#include "bindings/bindings.h"\n${SNIPPET}`)
src = src.replace('ffi::start_app();', 'neoma_hide_input_accessory();\n\tffi::start_app();')
await writeFile(mainMm, src)
console.log('patch-ios-webview: hid the WKWebView keyboard accessory bar')
