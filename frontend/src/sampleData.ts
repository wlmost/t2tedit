/**
 * Sample data for the SA660 → SAP IDoc DELVRY03 demo mapping.
 *
 * Source: SA660 intermediate JSON format (Lieferschein / delivery note)
 * Target: SAP IDoc DELVRY03 EDI_DC40 control record structure
 */

import type { MappingRule } from './types';

/** SA660 source data (segment 660 = header, segment 661 = line items) */
export const SA660_SOURCE = {
  '660': {
    Satzart: '660',
    'NL-Nummer': '897',
    Belegart: 'KULB',
    Belegnummer: '1009378',
    Empfaenger: '009999',
    Lieferantennummer: '009999',
    Belegdatum: '20260325',
    Buchungsdatum: '20260325',
    Abrufnummer: '',
    Belegtext1: '',
    Belegtext2: '',
    Bearbeiter: '175',
    Lieferdatum: '20260325',
    Lieferscheinnummer: '',
    Warenretoure: '',
    Abschlag: '00',
    Falschlieferung: '0',
    Auftragsnummer: '',
    Belegvariante: 'O',
    'SAP-Liefernummer': '7017802186',
    Anzahl_Pakete: '00',
    Abholort: '02',
    'Hybris-Bestellnummer': '000039615894',
  },
  '661': [
    {
      Satzart: '661',
      'NL-Nummer': '897',
      Belegart: 'KULB',
      Belegnummer: '1009378',
      Lieferantennummer: '000000',
      Positionsnummer: '00010',
      BahagNummer: '20122391',
      Buchungsmenge: '+00002.000',
      Mengeneinheit: '01',
      Preis_alt: '+00000029.38',
      Positionstext1: 'Geberit Duofix Bausatz 111.815',
      Positionstext2: '.00.1 (Geb',
      Positionsbetreff1: 'abweichender Preis',
      Positionsbetreff2: '',
      Tracking_Id: '',
      Referenzposition: '00000',
      Regal: '003',
      Fach: '024',
    },
    {
      Satzart: '661',
      'NL-Nummer': '897',
      Belegart: 'KULB',
      Belegnummer: '1009378',
      Lieferantennummer: '000000',
      Positionsnummer: '00020',
      BahagNummer: '20219318',
      Buchungsmenge: '+00004.000',
      Mengeneinheit: '01',
      Preis_alt: '+00000046.00',
      Positionstext1: 'Comisa Schraub-T-Stück (Durchm)',
      Positionstext2: 'esser: 16',
      Positionsbetreff1: 'abweichender Preis',
      Positionsbetreff2: '',
      Tracking_Id: '',
      Referenzposition: '00000',
      Regal: '003',
      Fach: '024',
    },
  ],
};

/**
 * SAP IDoc DELVRY03 – EDI_DC40 control record target structure.
 * Field names and descriptions are taken from DELVRY03.txt.
 *
 * `_positions` contains the standard SAP fixed-width character ranges (1-indexed)
 * for the EDI_DC40 control record, enabling the Groovy-script result to be
 * rendered as a proper IDoc flat-file line in the "Resulting Target Format" panel.
 */
export const IDOC_DC40_TARGET = {
  EDI_DC40: {
    TABNAM: '', // Name der Tabellenstruktur
    MANDT: '', // Mandant
    DOCNUM: '', // Nummer des IDocs
    DOCREL: '', // SAP-Release des IDocs
    STATUS: '', // Status des IDocs
    DIRECT: '1', // Richtung (1=Ausgang)
    OUTMOD: '1', // Ausgabemodus
    EXPRSS: '', // Übersteuerung im Eingang
    TEST: '', // Testkennzeichen
    IDOCTYP: '', // Name des Basistyps
    CIMTYP: '', // Erweiterung (vom Kunden definiert)
    MESTYP: '', // Nachrichtentyp
    MESCOD: '', // Nachrichtenvariante
    MESFCT: '', // Nachrichtenfunktion
    STD: '', // EDI-Standard, Kennzeichen
    STDVRS: '', // EDI-Standard, Version und Release
    STDMES: '', // EDI-Nachrichtentyp
    SNDPOR: '', // Absenderport
    SNDPRT: '', // Partnerart des Absenders
    SNDPFC: '', // Partnerrolle des Absenders
    SNDPRN: '', // Partnernummer des Absenders
    SNDSAD: '', // Absenderadresse (SADR)
    SNDLAD: '', // Logische Adresse des Absenders
    RCVPOR: '', // Empfängerport
    RCVPRT: '', // Partnerart des Empfängers
    RCVPFC: '', // Partnerrolle des Empfängers
    RCVPRN: '', // Partnernummer des Empfängers
    RCVSAD: '', // Empfängeradresse (SADR)
    RCVLAD: '', // Logische Adresse des Empfängers
    CREDAT: '', // Erstellungsdatum
    CRETIM: '', // Erstellungsuhrzeit
    REFINT: '', // Übertragungsdatei (EDI Interchange)
    REFGRP: '', // Nachrichtengruppe (EDI Message Group)
    REFMES: '', // Nachricht (EDI Message)
    ARCKEY: '', // Schlüssel des externen Nachrichtenarchivs
    SERIAL: '', // Serialisierung
  },
  // Standard SAP character positions (1-indexed) for the EDI_DC40 control record,
  // derived from the SAP EDIDC table structure (ABAP dictionary).
  // Ranges are non-overlapping and contiguous.
  // Total fixed-width line length: 652 characters (end of SERIAL field).
  _positions: {
    EDI_DC40: {
      TABNAM: [1,   10]  as [number, number], // CHAR 10
      MANDT:  [11,  13]  as [number, number], // CLNT  3
      DOCNUM: [14,  29]  as [number, number], // NUMC 16
      DOCREL: [30,  34]  as [number, number], // CHAR  5
      STATUS: [35,  36]  as [number, number], // CHAR  2
      DIRECT: [37,  37]  as [number, number], // CHAR  1
      OUTMOD: [38,  38]  as [number, number], // CHAR  1
      EXPRSS: [39,  39]  as [number, number], // CHAR  1
      TEST:   [40,  40]  as [number, number], // CHAR  1
      IDOCTYP:[41,  70]  as [number, number], // CHAR 30
      CIMTYP: [71,  100] as [number, number], // CHAR 30
      MESTYP: [101, 130] as [number, number], // CHAR 30
      MESCOD: [131, 133] as [number, number], // CHAR  3
      MESFCT: [134, 135] as [number, number], // CHAR  2
      STD:    [136, 138] as [number, number], // CHAR  3
      STDVRS: [139, 144] as [number, number], // CHAR  6
      STDMES: [145, 174] as [number, number], // CHAR 30
      SNDPOR: [175, 184] as [number, number], // CHAR 10
      SNDPRT: [185, 186] as [number, number], // CHAR  2
      SNDPFC: [187, 188] as [number, number], // CHAR  2
      SNDPRN: [189, 198] as [number, number], // CHAR 10
      SNDSAD: [199, 219] as [number, number], // CHAR 21
      SNDLAD: [220, 289] as [number, number], // CHAR 70
      RCVPOR: [290, 299] as [number, number], // CHAR 10
      RCVPRT: [300, 301] as [number, number], // CHAR  2
      RCVPFC: [302, 303] as [number, number], // CHAR  2
      RCVPRN: [304, 313] as [number, number], // CHAR 10
      RCVSAD: [314, 334] as [number, number], // CHAR 21
      RCVLAD: [335, 404] as [number, number], // CHAR 70
      CREDAT: [405, 412] as [number, number], // DATS  8
      CRETIM: [413, 418] as [number, number], // TIMS  6
      REFINT: [419, 466] as [number, number], // CHAR 48
      REFGRP: [467, 514] as [number, number], // CHAR 48
      REFMES: [515, 562] as [number, number], // CHAR 48
      ARCKEY: [563, 632] as [number, number], // CHAR 70
      SERIAL: [633, 652] as [number, number], // CHAR 20
    },
  },
};

export const DEMO_MAPPING_NAME = 'SA660 → IDoc DELVRY03';
export const DEMO_MAPPING_DESCRIPTION =
  'Maps SA660 Lieferschein format to SAP IDoc DELVRY03 EDI_DC40 control record';

/** Starter mapping rules illustrating the SA660 → EDI_DC40 field correspondence */
export const DEMO_RULES: MappingRule[] = [
  {
    id: 'demo-r1',
    sourcePath: '660.Belegnummer',
    targetPath: 'EDI_DC40.DOCNUM',
    transform: 'direct',
  },
  {
    id: 'demo-r2',
    sourcePath: '660.Belegdatum',
    targetPath: 'EDI_DC40.CREDAT',
    transform: 'direct',
  },
  {
    id: 'demo-r3',
    sourcePath: '660.SAP-Liefernummer',
    targetPath: 'EDI_DC40.REFMES',
    transform: 'direct',
  },
  {
    id: 'demo-r4',
    sourcePath: '660.Lieferantennummer',
    targetPath: 'EDI_DC40.SNDPRN',
    transform: 'direct',
  },
  {
    id: 'demo-r5',
    sourcePath: '660.Empfaenger',
    targetPath: 'EDI_DC40.RCVPRN',
    transform: 'direct',
  },
  {
    id: 'demo-r6',
    sourcePath: '660.Lieferdatum',
    targetPath: 'EDI_DC40.REFGRP',
    transform: 'template',
    template: 'LIEFDAT:{{value}}',
  },
];

/**
 * Groovy script for the SA660 → IDoc DELVRY03 mapping.
 * The `source` binding holds the full SA660 source JSON.
 * Segments are accessed with quoted keys, e.g. source.'660'.fieldName.
 * The script uses the target{} builder DSL (ySE-compatible) to define the target
 * structure without array literals.
 */
export const DEMO_GROOVY_SCRIPT = `\
// SA660 → SAP IDoc DELVRY03 — EDI_DC40 control record
// Available binding: source (full SA660 JSON)
// Segments are accessed as source.'660', source.'661', etc.

def header = source.'660'

return target {
  EDI_DC40 {
    TABNAM ('EDI_DC40')
    MANDT  ('')
    DOCNUM (header.Belegnummer)
    DOCREL ('')
    STATUS ('30')
    DIRECT ('1')           // Ausgang
    OUTMOD ('1')
    EXPRSS ('')
    TEST   ('')
    IDOCTYP('DELVRY03')
    MESTYP ('DELVRY')
    MESCOD ('')
    MESFCT ('')
    STD    ('')
    STDVRS ('')
    STDMES (header.Satzart)
    SNDPOR ('')
    SNDPRT ('LS')
    SNDPFC ('')
    SNDPRN (header.Lieferantennummer)
    SNDSAD ('')
    SNDLAD ('')
    RCVPOR ('')
    RCVPRT ('KU')
    RCVPFC ('')
    RCVPRN (header.Empfaenger)
    RCVSAD ('')
    RCVLAD ('')
    CREDAT (header.Belegdatum)
    CRETIM ('')
    REFINT ('')
    REFGRP ("LIEFDAT:\${header.Lieferdatum}")
    REFMES (header.'SAP-Liefernummer')
    ARCKEY ('')
    SERIAL ('')
  }
}
`;
