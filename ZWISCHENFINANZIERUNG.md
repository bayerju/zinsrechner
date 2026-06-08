# Zwischenfinanzierung

## Umfang der ersten Version

Die Zwischenfinanzierung wird bewusst vereinfacht berechnet:

- Der Verkaufszeitraum der bisherigen Immobilie entspricht der Laufzeit der
  Zwischenfinanzierung.
- Für die Berechnung ist nur die tatsächlich aufgenommene Darlehenssumme
  relevant.
- Ein erwarteter Verkaufspreis wird nicht erfasst.
- Die Restschuld der bisherigen Immobilie wird nicht erfasst.
- Verkaufskosten werden nicht erfasst.
- Die Zinsen werden während der gesamten Laufzeit monatlich gezahlt.
- Während der Laufzeit findet keine Tilgung statt.
- Am Ende der Laufzeit wird die gesamte aufgenommene Darlehenssumme auf einmal
  zurückgezahlt.
- Es wird angenommen, dass diese vollständige Rückzahlung möglich ist. Die
  Herkunft des dafür verwendeten Geldes wird nicht geprüft.
- Die Schlusszahlung wird im Finanzplan als Tilgung und Fälligkeit behandelt.
  Sie wird nicht vom verfügbaren Haushaltskapital im Liquiditätsplan abgezogen,
  weil der zugehörige Verkaufserlös ebenfalls nicht modelliert wird.
- Sondertilgungen oder eine teilweise vorzeitige Ablösung werden nicht
  berücksichtigt.
- Eine Verlängerung oder Anschlussfinanzierung der Zwischenfinanzierung wird
  nicht berücksichtigt.

## Berechnung

Die monatliche Zinszahlung wird mit dem zum effektiven Jahreszins äquivalenten
Monatszins berechnet:

```text
Monatszins = (1 + effektiver Jahreszins / 100)^(1 / 12) - 1
Monatliche Zinszahlung = Darlehenssumme * Monatszins
```

Bis unmittelbar vor dem Laufzeitende entspricht die Restschuld der vollen
Darlehenssumme. Am Laufzeitende wird die Darlehenssumme vollständig fällig und
die Restschuld anschließend mit null ausgewiesen.

## Spätere Erweiterungen

Eine spätere Version kann Verkaufspreis, Restschuld der bisherigen Immobilie,
Verkaufskosten, abweichenden Verkaufszeitpunkt, Sondertilgungen, Teilablösung
und eine verbleibende Restschuld ergänzen.
