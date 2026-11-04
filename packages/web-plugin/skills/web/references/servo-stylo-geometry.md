# Servo Stylo & Euclid Geometry Reference

The 31 Servo crates consolidated under `crates/servo-*` supply world-class web rendering algorithms in pure Rust.

## Core Pillars

1. **Stylo CSS Engine (`servo-stylo`, `servo-cssparser`, `selectors`)**:
   - Mozilla & Servo's parallel CSS style matching engine.
   - Calculates exact specificity tuples `(id_count, class_attr_pseudo_count, element_pseudoelement_count)`.
   - Packs specificity into a 30-bit integer for fast sorting: `(a << 20) | (b << 10) | c`.
2. **Servo Euclid Geometry (`servo-euclid`)**:
   - Strongly-typed 2D and 3D linear algebra primitives.
   - Prevents unit conversion bugs by parameterizing types with unit tags (`CssPixel`, `DevicePixel`, `WorldSpace`).
   - Supports scale factors (`Scale<f32, CssPixel, DevicePixel>`), bounding boxes (`Rect<f32, U>`), and points (`Point2D<f32, U>`).
3. **HTML5 & XML5 Parsers (`servo-html5ever`, `servo-markup5ever`, `servo-xml5ever`)**:
   - Living standard W3C compliant tokenizers and tree builders.
   - Memory-efficient streaming with `servo-tendril` and atom string interning with `servo-string-cache`.
4. **XPath 1.0 to CSS3 Compiler (`servo-xpath`)**:
   - Compiles legacy XPath queries into performant CSS selectors compatible with browser querying engines.
5. **WebVTT Subtitle Parser (`servo-webvtt`)**:
   - Parses WebVTT timestamp headers, cues, voice spans, and positioning attributes.
