# Expo studio experience

The iOS and Android app uses LeClap’s lavender palette, Oswald display typography and system body text. Its light studio surface keeps template previews and the user’s videos central. It opens as soon as fonts are ready, without a mandatory animated intro. Dark appearance is not implemented by this refinement.

## Discovery and navigation

The tab bar contains two destinations: Scenarios and Videos. Creating a template is an explicitly labelled action in Scenarios. Headers consume the top safe area; tabs consume the bottom safe area, so screen content does not receive those insets twice.

The template gallery displays bundled stills from the real showcase renders. Portrait and square stills use `contain`, preserving their full frame. User templates receive a distinct custom cover. Template IDs select posters; names remain the existing navigation keys. Keep the native poster assets and registry in sync when regenerating showcase renders; see `apps/leclap-expo/assets/template-previews/README.md`.

Search matches displayed names and localized section text, including resolved template variables. It ignores accents and surrounding whitespace and accepts regional locales such as `fr-FR`. English and the first available translation provide fallbacks. The search input retains focus while results change. No-result states offer a clear-search action.

Phone layouts use two columns, tablets three. Narrow phones and large system text switch to one column. Gallery bottom spacing reserves room for the Create action. Headings and sheet content can grow and scroll with text size.

## Clappy

Clappy’s fixed paths, frame and palette live in `@leclap/creative-kit/clappy`, shared with the web renderer. The native component uses `react-native-svg`, with no remote artwork, image fetch or extra native dependency.

| State     | Placement                      | Behaviour                                           |
| --------- | ------------------------------ | --------------------------------------------------- |
| `welcome` | Scenarios header, empty Videos | Raised hand; brief greeting tilt                    |
| `search`  | Empty search results           | Sideways gaze; short settling motion                |
| `error`   | Catalog load failure           | Calm expression beside recovery instructions        |
| `working` | Render overlay                 | Focused expression; stationary throughout rendering |
| `success` | Export sheet                   | Raised arms and happy eyes; brief celebratory tilt  |

Clappy is decorative and hidden from assistive technology; adjacent text communicates the state. Motion runs on the UI thread and respects system Reduce Motion. There are no infinite mascot loops. Shared press controls use opacity feedback instead of scaling under Reduce Motion; sheets replace slides with fades.

## Rendering and export

The render overlay reads the real engine progress store. A progress bar exposes the percentage to screen readers, stage text can wrap, and Cancel remains available while rendering. The privacy message describes the existing on-device compilation path.

Export offers Save and Share first; uploading to a URL is disclosed on demand. The sheet preserves the bottom safe area, scrolls with the keyboard and exposes expanded, busy and disabled states. Media-library permission and asset modules load when Save is requested. Permission failures return the action to a recoverable state.

New UI copy is supplied in English, French, German, Spanish and Italian. The refined controls use at least 48-point/dp targets. Primary actions use deeper lavender with white labels; ordinary lavender remains the brand accent.

## Verification

Run Expo unit tests and typechecking, lint changed code, check both native Metro bundles, and review the gallery, empty search, render cancellation and export disclosure at phone and tablet sizes. Browser rendering of native components is useful for layout review, but does not verify native safe areas, VoiceOver/TalkBack, device text sizing or permission/share sheets. Those require a simulator or device pass.
