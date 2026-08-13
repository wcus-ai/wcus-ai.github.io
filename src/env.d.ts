interface ImportMetaEnv {
  /** Absolute URL of the tracking worker's `/track` route. Set at build time. */
  readonly PUBLIC_TRACKING_ENDPOINT: string;
  /** Google Form ID for the shared feedback form. Optional until form exists. */
  readonly PUBLIC_FEEDBACK_FORM_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
