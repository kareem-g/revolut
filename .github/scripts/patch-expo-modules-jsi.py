#!/usr/bin/env python3
"""Patch expo-modules-jsi 57.1.1 so it builds with the Xcode 26.x toolchain.

ExpoModulesCore re-exports ExpoModulesJSI and hard-depends on it, so it cannot
be skipped. Two constructs in the shipped sources are rejected by Swift 6.2.4
(Xcode 26.0 shipped 6.2.0, which rejects even more of it):

1. `Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h` annotates the
   constructors with SWIFT_RETURNS_RETAINED. Swift rejects that on an
   initializer because the class is not a SWIFT_SHARED_REFERENCE type in that
   position. Upstream moved the annotation to static create() factories;
   dropping it here is equivalent, because Swift's initializer convention is
   already +1 and the object starts with refCount = 1.

2. `Sources/ExpoModulesJSI/Runtime/JavaScriptRuntime.swift` captures raw
   pointers in escaping closures via `nonisolated(unsafe) let`. Swift 6.2.4
   reports "sending 'x' risks causing data races" for those captures. Upstream
   boxes them instead; the package already ships `NonisolatedUnsafeVar` for
   precisely this workaround (it is used a few lines below for a Swift 6.2.3
   compiler bug), so reuse it.

Both changes are source-only and keep Swift 6 mode, so the compiled module's
ABI still matches the prebuilt ExpoModulesCore. Never patch this down to Swift
5 mode — that changes the ABI and the app dies at launch with a dyld
"Symbol not found" for JavaScriptActor.runIsolated.
"""
from __future__ import annotations

import pathlib
import sys

mobile_dir = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
sources = mobile_dir / "node_modules" / "expo-modules-jsi" / "apple" / "Sources"
if not sources.is_dir():
    sys.exit(f"expo-modules-jsi sources not found under {sources}")

# --- 1. C++ interop annotation on the RuntimeScheduler constructors ----------
header = sources / "ExpoModulesJSI-Cxx" / "include" / "RuntimeScheduler.h"
text = header.read_text()
patched = text.replace("SWIFT_RETURNS_RETAINED RuntimeScheduler(", "RuntimeScheduler(")
if patched == text:
    sys.exit(f"no SWIFT_RETURNS_RETAINED constructors found in {header}")
print(f"removed SWIFT_RETURNS_RETAINED from {text.count('SWIFT_RETURNS_RETAINED RuntimeScheduler(')} constructors")
header.write_text(patched)

# --- 2. pointer captures across the isolation boundary -----------------------
runtime = sources / "ExpoModulesJSI" / "Runtime" / "JavaScriptRuntime.swift"
text = runtime.read_text()
replacements = [
    (
        "nonisolated(unsafe) let resultPtr = resultPtr",
        "let resultPtr = NonisolatedUnsafeVar(resultPtr)",
    ),
    (
        "nonisolated(unsafe) let thisPtr = thisPtr",
        "let thisPtr = NonisolatedUnsafeVar(thisPtr)",
    ),
    (
        "nonisolated(unsafe) let argumentsPtr = argumentsPtr",
        "let argumentsPtr = NonisolatedUnsafeVar(argumentsPtr)",
    ),
    ("writeJSIValue(to: resultPtr)", "writeJSIValue(to: resultPtr.value)"),
    (
        "UnsafeMutablePointer(mutating: thisPtr).move()",
        "UnsafeMutablePointer(mutating: thisPtr.value).move()",
    ),
    ("start: argumentsPtr, count", "start: argumentsPtr.value, count"),
    (
        "JavaScriptUnownedValue(runtime.pointee, thisPtr)",
        "JavaScriptUnownedValue(runtime.pointee, thisPtr.value)",
    ),
]
for old, new in replacements:
    count = text.count(old)
    if count == 0:
        sys.exit(f"pattern not found (expo-modules-jsi changed?): {old}")
    text = text.replace(old, new)
    print(f"patched {count}x: {old}")
runtime.write_text(text)

print("expo-modules-jsi patched for Swift 6.2.4")