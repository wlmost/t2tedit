/**
 * Sample data for the SA660 → SAP IDoc DELVRY03 demo mapping.
 *
 * Source: SA660 intermediate JSON format (Lieferschein / delivery note)
 * Target: SAP IDoc DELVRY03 EDI_DC40 control record structure
 */

import type { MappingRule } from './types';

/** SA660 source data (segment 660 = header, segment661 = line items) */
export const SA660_SOURCE = {
  segment660: {
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
  segment661: [
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
};

export const DEMO_MAPPING_NAME = 'SA660 → IDoc DELVRY03';
export const DEMO_MAPPING_DESCRIPTION =
  'Maps SA660 Lieferschein format to SAP IDoc DELVRY03 EDI_DC40 control record';

/** Starter mapping rules illustrating the SA660 → EDI_DC40 field correspondence */
export const DEMO_RULES: MappingRule[] = [
  {
    id: 'demo-r1',
    sourcePath: 'segment660.Belegnummer',
    targetPath: 'EDI_DC40.DOCNUM',
    transform: 'direct',
  },
  {
    id: 'demo-r2',
    sourcePath: 'segment660.Belegdatum',
    targetPath: 'EDI_DC40.CREDAT',
    transform: 'direct',
  },
  {
    id: 'demo-r3',
    sourcePath: 'segment660.SAP-Liefernummer',
    targetPath: 'EDI_DC40.REFMES',
    transform: 'direct',
  },
  {
    id: 'demo-r4',
    sourcePath: 'segment660.Lieferantennummer',
    targetPath: 'EDI_DC40.SNDPRN',
    transform: 'direct',
  },
  {
    id: 'demo-r5',
    sourcePath: 'segment660.Empfaenger',
    targetPath: 'EDI_DC40.RCVPRN',
    transform: 'direct',
  },
  {
    id: 'demo-r6',
    sourcePath: 'segment660.Lieferdatum',
    targetPath: 'EDI_DC40.REFGRP',
    transform: 'template',
    template: 'LIEFDAT:{{value}}',
  },
];

/**
 * Groovy script for the SA660 → IDoc DELVRY03 mapping.
 * The `input` binding holds the full SA660 source JSON.
 * The script returns a Groovy map that is serialised to JSON by the bridge.
 */
export const DEMO_GROOVY_SCRIPT = `\
// SA660 → SAP IDoc DELVRY03 — EDI_DC40 control record
// Available binding: input (full SA660 JSON)

def header = input.segment660

return [
  EDI_DC40: [
    TABNAM : 'EDI_DC40',
    MANDT  : '',
    DOCNUM : header.Belegnummer,
    DOCREL : '',
    STATUS : '30',
    DIRECT : '1',          // Ausgang
    OUTMOD : '1',
    EXPRSS : '',
    TEST   : '',
    IDOCTYP: 'DELVRY03',
    MESTYP : 'DELVRY',
    MESCOD : '',
    MESFCT : '',
    STD    : '',
    STDVRS : '',
    STDMES : '',
    SNDPOR : '',
    SNDPRT : 'LS',
    SNDPFC : '',
    SNDPRN : header.Lieferantennummer,
    SNDSAD : '',
    SNDLAD : '',
    RCVPOR : '',
    RCVPRT : 'KU',
    RCVPFC : '',
    RCVPRN : header.Empfaenger,
    RCVSAD : '',
    RCVLAD : '',
    CREDAT : header.Belegdatum,
    CRETIM : '',
    REFINT : '',
    REFGRP : "LIEFDAT:\${header.Lieferdatum}",
    REFMES : header.'SAP-Liefernummer',
    ARCKEY : '',
    SERIAL : ''
  ]
]
`;
