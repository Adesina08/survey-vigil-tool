const DEFAULT_TITLE = "OGUN LGA MAP";
const DEFAULT_SUBTITLE = "Submissions by LGA";
const DEFAULT_EXPORT_PREFIX = "ogun-lga-map";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toOptionalStringOrNull = (value: unknown): string | null | undefined => {
  if (value === null) {
    return null;
  }
  return toOptionalString(value);
};

const pickFirst = <T>(values: Array<T | undefined>): T | undefined => {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
};

const pickFirstNullable = (values: Array<string | null | undefined>): string | null | undefined => {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
};

export interface MapMetadataConfig {
  title?: string | null;
  subtitle?: string | null;
  exportFilenamePrefix?: string | null;
}

export interface NormalizedMapMetadata {
  title: string;
  subtitle: string | null;
  exportFilenamePrefix: string;
}

export const normalizeMapMetadata = (input?: MapMetadataConfig): NormalizedMapMetadata => {
  const titleCandidate = toOptionalString(input?.title ?? undefined);
  const subtitleCandidate = toOptionalStringOrNull(input?.subtitle ?? undefined);
  const exportPrefixCandidate = toOptionalString(input?.exportFilenamePrefix ?? undefined);

  return {
    title: titleCandidate ?? DEFAULT_TITLE,
    subtitle:
      input?.subtitle === null
        ? null
        : subtitleCandidate ?? DEFAULT_SUBTITLE,
    exportFilenamePrefix: exportPrefixCandidate ?? DEFAULT_EXPORT_PREFIX,
  };
};

const titleKeys = ["title", "heading", "name", "label"];
const subtitleKeys = ["subtitle", "subheading", "description", "details", "text"];
const exportKeys = [
  "exportFilenamePrefix",
  "exportFilePrefix",
  "filePrefix",
  "filenamePrefix",
  "exportPrefix",
  "downloadPrefix",
];

const mapTitleKeys = [
  "mapTitle",
  "map_title",
  "mapHeading",
  "map_heading",
  "mapSectionTitle",
  "map_section_title",
  "mapName",
  "map_name",
  "interactiveMapTitle",
  "interactive_map_title",
];

const mapSubtitleKeys = [
  "mapSubtitle",
  "map_subtitle",
  "mapDescription",
  "map_description",
  "mapSectionSubtitle",
  "map_section_subtitle",
  "interactiveMapSubtitle",
  "interactive_map_subtitle",
];

const mapExportKeys = [
  "mapExportFilenamePrefix",
  "map_export_filename_prefix",
  "mapExportPrefix",
  "map_export_prefix",
  "mapFilenamePrefix",
  "map_filename_prefix",
];

const extractFromRecord = (record: unknown): MapMetadataConfig | null => {
  if (!isRecord(record)) {
    return null;
  }

  const title = pickFirst(titleKeys.map((key) => toOptionalString(record[key])));
  const subtitle = pickFirstNullable(subtitleKeys.map((key) => toOptionalStringOrNull(record[key])));
  const exportPrefix = pickFirst(exportKeys.map((key) => toOptionalString(record[key])));

  if (!title && subtitle === undefined && !exportPrefix) {
    return null;
  }

  const result: MapMetadataConfig = {};
  if (title) {
    result.title = title;
  }
  if (subtitle !== undefined) {
    result.subtitle = subtitle;
  }
  if (exportPrefix) {
    result.exportFilenamePrefix = exportPrefix;
  }
  return result;
};

const extractFromFlatRecord = (record: Record<string, unknown>): MapMetadataConfig | null => {
  const title = pickFirst(mapTitleKeys.map((key) => toOptionalString(record[key])));
  const subtitle = pickFirstNullable(mapSubtitleKeys.map((key) => toOptionalStringOrNull(record[key])));
  const exportPrefix = pickFirst(mapExportKeys.map((key) => toOptionalString(record[key])));

  if (!title && subtitle === undefined && !exportPrefix) {
    return null;
  }

  const result: MapMetadataConfig = {};
  if (title) {
    result.title = title;
  }
  if (subtitle !== undefined) {
    result.subtitle = subtitle;
  }
  if (exportPrefix) {
    result.exportFilenamePrefix = exportPrefix;
  }
  return result;
};

const candidateKeys = ["map", "mapSection", "interactiveMap", "lgaMap", "mapConfig"];

const collectSectionCandidates = (value: unknown): MapMetadataConfig | null => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!isRecord(entry)) {
        continue;
      }
      const identifier = pickFirst(
        ["id", "key", "slug", "name", "section", "type"].map((key) => toOptionalString(entry[key]))
      );
      if (identifier && identifier.toLowerCase().includes("map")) {
        const extracted = extractFromRecord(entry);
        if (extracted) {
          return extracted;
        }
      }
    }
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of candidateKeys) {
    if (key in value) {
      const extracted = extractFromRecord(value[key]);
      if (extracted) {
        return extracted;
      }
    }
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key.toLowerCase().includes("map")) {
      const extracted = extractFromRecord(entry);
      if (extracted) {
        return extracted;
      }
    }
  }

  return null;
};

const mapMetadataCandidate = (
  base: Record<string, unknown>,
  key: string,
): MapMetadataConfig | null => extractFromRecord(base[key]);

export const extractMapMetadataFromPayload = (payload: unknown): MapMetadataConfig | undefined => {
  if (!isRecord(payload)) {
    return undefined;
  }

  const candidates: Array<MapMetadataConfig | null | undefined> = [];

  candidates.push(extractFromRecord(payload.mapMetadata));

  if (isRecord(payload.metadata)) {
    candidates.push(extractFromFlatRecord(payload.metadata));
    candidates.push(mapMetadataCandidate(payload.metadata, "map"));
    candidates.push(mapMetadataCandidate(payload.metadata, "mapSection"));
  }

  if (isRecord(payload.settings)) {
    candidates.push(mapMetadataCandidate(payload.settings, "map"));
  }

  candidates.push(collectSectionCandidates(payload.sections));

  candidates.push(extractFromFlatRecord(payload));

  for (const candidate of candidates) {
    if (candidate && (candidate.title || candidate.subtitle !== undefined || candidate.exportFilenamePrefix)) {
      return candidate;
    }
  }

  return undefined;
};

