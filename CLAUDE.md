# green-light.dk – Website

## Projektbeskrivelse

Hjemmeside for **Green Light**, en dansk virksomhed der skaber øget trivsel gennem innovative belysningskoncepter til virksomheder og det offentlige.

Siden er bygget som en ren HTML/CSS/JS-fil uden build-trin eller afhængigheder.

## Filstruktur

```
index.html   — Eneste fil. Indeholder alt: markup, styles og JavaScript.
```

## Hvad er bygget

### Hero-sektion med spotlight-museffekt

- Mørk baggrund (`#000`) med en radial-gradient "hul" der følger musen og afslører indholdet bag et mørkt overlay.
- Brugerdefineret cursor (lille lysende prik) der erstatter system-cursoren.
- Smooth follow-animation via `requestAnimationFrame` og lineær interpolation (`lerp` med faktor `0.12`).
- Spotlight deaktiveres automatisk på mobil (under 768 px), og system-cursor genoprettes.

### Layout

- Venstre kolonne: Brandnavn (`green` / `light`) + tagline.
- Højre kolonne: USP-liste med tre punkter og inline SVG-ikoner.
- Lodret divider imellem de to kolonner.
- Subtil grøn glow-linje langs bunden (`floor-glow`).

### Design-tokens

| Token | Værdi |
|---|---|
| Primær grøn | `#6ee7a0` |
| Baggrund | `#000` |
| Tekst (primær) | `#ffffff` |
| Tekst (dæmpet) | `rgba(255,255,255,0.82–0.88)` |
| Font | Inter (Google Fonts), 300/400/500/600/700 |

## Tekniske noter

- Spotlight-overlayets `background`-property opdateres direkte via `element.style.background` i hvert animationsframe for at undgå CSS-transitions der ville forringe effekten.
- Animation-loopet pauses via `visibilitychange`-eventet når fanen er skjult.
- Siden er responsiv: på mobil vendes layoutet lodret, spotlight-overlay og custom cursor skjules.

## Sprog

Al tekst på siden er på **dansk**.
