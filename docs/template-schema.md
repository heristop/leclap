# 📋 Template Schema Documentation

> ⚠️ **Outdated.** This document predates the current schema and describes an aspirational model (elements/animations/transitions) that does not match the code. See **[Template Configuration (JSON)](./template-configuration.md)** for the accurate, schema-backed reference.

This document describes the JSON schema used for video template descriptors in FFmpeg Video Composer.

## Overview

Template descriptors are JSON files that define how videos should be composed. They consist of global configuration and a series of sections that define the video timeline.

## Schema Structure

### Root Level

```typescript
interface TemplateDescriptor {
  global: GlobalConfig;
  sections: Section[];
}
```

### Global Configuration

```typescript
interface GlobalConfig {
  // Video output settings
  output: {
    width: number; // Video width in pixels
    height: number; // Video height in pixels
    fps: number; // Frames per second
    duration?: number; // Total duration in seconds (optional)
    format: string; // Output format (e.g., "mp4", "mov")
    codec?: string; // Video codec (default: "libx264")
    quality?: string; // Quality preset (e.g., "high", "medium", "low")
  };

  // Audio settings
  audio?: {
    sampleRate?: number; // Audio sample rate (default: 44100)
    channels?: number; // Audio channels (default: 2)
    codec?: string; // Audio codec (default: "aac")
    bitrate?: string; // Audio bitrate (e.g., "128k")
  };

  // Background settings
  background?: {
    type: 'color' | 'image' | 'video';
    value: string; // Color hex, image path, or video path
    opacity?: number; // Opacity (0-1)
  };

  // Text styling defaults
  textDefaults?: {
    font?: string; // Font family
    size?: number; // Font size
    color?: string; // Text color
    alignment?: 'left' | 'center' | 'right';
    weight?: 'normal' | 'bold';
  };
}
```

### Sections

```typescript
interface Section {
  // Basic properties
  id: string; // Unique section identifier
  type: SectionType; // Type of section
  duration: number; // Section duration in seconds
  startTime?: number; // Start time offset (auto-calculated if not provided)

  // Content
  elements?: Element[]; // Visual elements in this section
  audio?: AudioConfig; // Audio configuration for this section
  transitions?: Transition[]; // Transitions in/out of this section

  // Conditional rendering
  conditions?: Condition[]; // Conditions for including this section
}
```

### Section Types

```typescript
enum SectionType {
  INTRO = 'intro',
  CONTENT = 'content',
  OUTRO = 'outro',
  BREAK = 'break',
  CUSTOM = 'custom',
}
```

### Elements

```typescript
interface Element {
  // Basic properties
  id: string;
  type: ElementType;
  startTime: number; // When element appears (relative to section)
  duration: number; // How long element lasts

  // Position and size
  position: {
    x: number; // X coordinate (0-1 normalized)
    y: number; // Y coordinate (0-1 normalized)
    width?: number; // Width (0-1 normalized, optional)
    height?: number; // Height (0-1 normalized, optional)
  };

  // Visual properties
  style?: {
    opacity?: number; // Opacity (0-1)
    rotation?: number; // Rotation in degrees
    scale?: number; // Scale factor (1 = normal size)
    borderRadius?: number; // Border radius in pixels
    shadow?: {
      offsetX: number;
      offsetY: number;
      blur: number;
      color: string;
    };
  };

  // Animation
  animations?: Animation[];

  // Element-specific content
  content: ElementContent;
}
```

### Element Types

```typescript
enum ElementType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  SHAPE = 'shape',
  AUDIO = 'audio',
}
```

### Element Content

Different element types have specific content structures:

#### Text Element

```typescript
interface TextContent {
  text: string; // Text content (can include variables)
  font?: string; // Font family override
  size?: number; // Font size override
  color?: string; // Text color override
  alignment?: 'left' | 'center' | 'right';
  weight?: 'normal' | 'bold';
  lineHeight?: number; // Line height multiplier
  letterSpacing?: number; // Letter spacing in pixels
}
```

#### Image Element

```typescript
interface ImageContent {
  src: string; // Image source path
  alt?: string; // Alt text
  fit?: 'contain' | 'cover' | 'fill' | 'scale-down';
  filter?: FilterConfig; // Image filters
}
```

#### Video Element

```typescript
interface VideoContent {
  src: string; // Video source path
  loop?: boolean; // Whether to loop video
  muted?: boolean; // Whether to mute audio
  volume?: number; // Volume level (0-1)
  startOffset?: number; // Start time within source video
  endOffset?: number; // End time within source video
  filter?: FilterConfig; // Video filters
}
```

#### Shape Element

```typescript
interface ShapeContent {
  shape: 'rectangle' | 'circle' | 'polygon';
  fill?: string; // Fill color
  stroke?: {
    color: string;
    width: number;
  };
  // Shape-specific properties
  properties?: {
    [key: string]: any;
  };
}
```

### Animations

```typescript
interface Animation {
  property: AnimationProperty;
  keyframes: Keyframe[];
  easing?: EasingFunction;
  duration?: number; // Animation duration (default: element duration)
  delay?: number; // Animation delay
  iterations?: number; // Number of iterations (default: 1)
}

enum AnimationProperty {
  OPACITY = 'opacity',
  POSITION = 'position',
  SCALE = 'scale',
  ROTATION = 'rotation',
}

interface Keyframe {
  time: number; // Time offset (0-1 normalized)
  value: any; // Property value at this time
  easing?: EasingFunction; // Easing for this segment
}

enum EasingFunction {
  LINEAR = 'linear',
  EASE_IN = 'ease-in',
  EASE_OUT = 'ease-out',
  EASE_IN_OUT = 'ease-in-out',
  CUBIC_BEZIER = 'cubic-bezier',
}
```

### Audio Configuration

```typescript
interface AudioConfig {
  // Background music
  music?: {
    src: string; // Audio file path
    volume?: number; // Volume level (0-1)
    loop?: boolean; // Whether to loop
    fadeIn?: number; // Fade in duration
    fadeOut?: number; // Fade out duration
    startOffset?: number; // Start time within audio file
  };

  // Sound effects
  effects?: SoundEffect[];

  // Audio mixing
  mixing?: {
    ducking?: number; // How much to duck background music (0-1)
    normalization?: boolean; // Whether to normalize audio levels
  };
}

interface SoundEffect {
  id: string;
  src: string; // Audio file path
  trigger: {
    time: number; // When to play (relative to section start)
    event?: string; // Optional event trigger
  };
  volume?: number; // Volume level (0-1)
  pan?: number; // Stereo pan (-1 to 1)
}
```

### Transitions

```typescript
interface Transition {
  type: TransitionType;
  duration: number; // Transition duration in seconds
  direction?: 'in' | 'out'; // Transition direction
  easing?: EasingFunction; // Transition easing
  properties?: {
    [key: string]: any; // Transition-specific properties
  };
}

enum TransitionType {
  FADE = 'fade',
  SLIDE = 'slide',
  ZOOM = 'zoom',
  ROTATE = 'rotate',
  WIPE = 'wipe',
  DISSOLVE = 'dissolve',
}
```

### Conditions

```typescript
interface Condition {
  type: ConditionType;
  field: string; // Field name to check
  operator: ConditionOperator;
  value: any; // Value to compare against
  caseSensitive?: boolean; // For string comparisons
}

enum ConditionType {
  FIELD = 'field', // Check project config field
  FEATURE = 'feature', // Check feature availability
  PLATFORM = 'platform', // Check platform type
}

enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists',
}
```

### Variables

Template descriptors support variable substitution using the format `{{variable_name}}`. Variables are resolved from the project configuration's `fields` object.

#### Variable Examples

```json
{
  "elements": [
    {
      "type": "text",
      "content": {
        "text": "Hello {{form_1_firstname}} {{form_1_lastname}}!"
      }
    }
  ]
}
```

#### Variable Formatting

Variables support formatting functions:

```json
{
  "text": "{{form_1_firstname|uppercase}} started on {{start_date|format:MM/DD/YYYY}}"
}
```

Available formatters:

- `uppercase` - Convert to uppercase
- `lowercase` - Convert to lowercase
- `capitalize` - Capitalize first letter
- `format:pattern` - Format dates/numbers
- `truncate:length` - Truncate to specified length

## Example Template

```json
{
  "global": {
    "output": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "format": "mp4"
    },
    "background": {
      "type": "color",
      "value": "#000000"
    }
  },
  "sections": [
    {
      "id": "intro",
      "type": "intro",
      "duration": 3,
      "elements": [
        {
          "id": "title",
          "type": "text",
          "startTime": 0.5,
          "duration": 2,
          "position": {
            "x": 0.5,
            "y": 0.3
          },
          "content": {
            "text": "Welcome {{form_1_firstname}}!",
            "size": 48,
            "color": "#ffffff",
            "alignment": "center"
          },
          "animations": [
            {
              "property": "opacity",
              "keyframes": [
                { "time": 0, "value": 0 },
                { "time": 0.3, "value": 1 },
                { "time": 0.7, "value": 1 },
                { "time": 1, "value": 0 }
              ]
            }
          ]
        }
      ],
      "audio": {
        "music": {
          "src": "intro-music.mp3",
          "volume": 0.3,
          "fadeIn": 0.5,
          "fadeOut": 0.5
        }
      }
    }
  ]
}
```

## Validation

Templates are validated against this schema at runtime. Invalid templates will throw descriptive errors indicating:

- Missing required fields
- Invalid field types or values
- Conflicting configurations
- Unsupported features for the target platform

## Best Practices

1. **Keep sections short** - Aim for 5-15 second sections for better performance
2. **Use relative positioning** - Use normalized coordinates (0-1) for responsive layouts
3. **Optimize assets** - Compress images and videos before referencing
4. **Test variables** - Always test templates with different variable values
5. **Plan animations** - Stagger animations to avoid visual conflicts
6. **Consider performance** - Limit concurrent animations and effects
