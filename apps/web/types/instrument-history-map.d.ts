interface InstrumentHistoryItem {
  masterQuestionId: string;
  question: string | null;
  response: string | null;
  evidenceSummary: string | null;
  constraintNote?: string | null;
  standardResult: string | null;
  processResult: string | null;
  responseStatus?: string | null;
}

interface MapConstructor {
  new (
    entries: Array<[string, InstrumentHistoryItem]>,
  ): Map<string, InstrumentHistoryItem>;
}
