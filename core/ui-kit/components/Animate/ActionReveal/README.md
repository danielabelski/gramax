# ActionReveal

Animated wrapper for an action that starts without occupying horizontal space and slides into the layout when revealed.

## Usage

```tsx
<ActionReveal isVisible={isOpen} revealOnGroupInteraction width="1.5rem">
  <IconButton aria-label="Actions" />
</ActionReveal>
```

- `width` is the final space reserved for the action.
- `isVisible` keeps the action revealed for controlled states such as an open menu.
- `revealOnGroupInteraction` also reveals it when the nearest parent with the Tailwind `group` class is hovered or contains focus.
- `className` and `contentClassName` extend the outer layout and moving content respectively.
- The content stays mounted while hidden, and reduced-motion preferences disable the transitions.

Use this wrapper for trailing controls that should shift adjacent content instead of overlaying it. Do not use it for content whose hidden state must remove it from the accessibility tree.
