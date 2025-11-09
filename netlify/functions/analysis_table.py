import json
import math
import os
from typing import Any, Dict, List, Optional
from urllib import error, request

import numpy as np
import pandas as pd
from great_tables import GT

CURATED_TOP_BREAKS = [
    "a3_select_the_lga",
    "a3b_select_the_ward",
    "a7_sex",
    "a8_age",
    "c4_current_employment_status",
    "d2_type_of_enterprise",
    "e2_business_sector",
    "g3_member_of_mens_womens_or_youth_group",
    "h1_satisfaction_with_ogstep",
    "h2_trust_in_implementing_institutions",
]

DEFAULT_LIMIT_CATEGORIES = 12
DEFAULT_BINS = 10
DEFAULT_MIN_COUNT = 1
DEFAULT_STAT = "rowpct"

_ALLOWED_STATS = {"counts", "rowpct", "colpct", "totalpct"}

_DATA_CACHE: Dict[str, Any] = {"df": None, "fields": None}


def _json_response(payload: Any, status: int = 200) -> Dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(payload, default=_json_default),
    }


def _json_default(value: Any):
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    return value


def _resolve_dashboard_url() -> str:
    explicit = os.environ.get("DASHBOARD_URL")
    if explicit:
        return explicit

    base = os.environ.get("DEPLOY_URL") or os.environ.get("URL")
    if base:
        return base.rstrip("/") + "/.netlify/functions/dashboard"

    return "http://localhost:8888/api/dashboard"


def _fetch_dashboard_payload() -> Dict[str, Any]:
    url = _resolve_dashboard_url()
    req = request.Request(url, headers={"Accept": "application/json"})
    try:
        with request.urlopen(req, timeout=30) as response:
            data = response.read().decode("utf-8")
            return json.loads(data)
    except error.HTTPError as exc:  # pragma: no cover - defensive
        raise RuntimeError(f"Dashboard request failed with status {exc.code}") from exc
    except error.URLError as exc:  # pragma: no cover - defensive
        raise RuntimeError("Unable to reach dashboard endpoint") from exc


def _normalize_value(value: Any):
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped else np.nan
    if value is None:
        return np.nan
    return value


def _load_dataset(force: bool = False) -> pd.DataFrame:
    if not force and _DATA_CACHE.get("df") is not None:
        return _DATA_CACHE["df"].copy()

    payload = _fetch_dashboard_payload()
    rows = payload.get("analysisRows") or payload.get("rows") or []
    df = pd.DataFrame(rows)
    if not df.empty:
        df = df.applymap(_normalize_value)
    _DATA_CACHE["df"] = df
    _DATA_CACHE["fields"] = _infer_fields(df)
    return df.copy()


def _infer_fields(df: pd.DataFrame) -> List[Dict[str, Any]]:
    fields: List[Dict[str, Any]] = []
    if df.empty:
        return fields

    for column in df.columns:
        series = df[column]
        series = series.replace("", np.nan)
        non_null = series.dropna()
        distinct = int(non_null.nunique())
        numeric_ratio = 0.0
        if len(non_null) > 0:
            numeric_candidate = pd.to_numeric(non_null, errors="coerce")
            numeric_ratio = float(numeric_candidate.notna().mean())
        inferred_type = "numeric" if numeric_ratio >= 0.8 else "categorical"
        fields.append({
            "name": column,
            "type": inferred_type,
            "distinct_count": distinct,
        })
    return fields


def _series_to_categorical(
    series: pd.Series,
    *,
    limit: int,
    drop_missing: bool,
    min_count: int,
    missing_label: str = "Missing",
) -> pd.Series:
    working = series.copy()
    working = working.replace("", np.nan)

    if drop_missing:
        working = working.dropna()
    else:
        working = working.fillna(missing_label)

    if working.empty:
        return working

    counts = working.value_counts(dropna=False)

    if min_count > 1:
        rare_labels = counts[counts < min_count].index
        if len(rare_labels) > 0:
            other_label = f"Other (n<{min_count})"
            working = working.apply(lambda value: value if value not in rare_labels else other_label)
            counts = working.value_counts(dropna=False)

    if limit and len(counts) > limit:
        keep = counts.index[: max(1, limit - 1)]
        other_label = "Other"
        working = working.apply(lambda value: value if value in keep else other_label)

    return working


def _prepare_topbreak_series(
    df: pd.DataFrame,
    column: str,
    *,
    limit: int,
    drop_missing: bool,
    min_count: int,
) -> pd.Series:
    series = df[column]
    if column == "a8_age":
        numeric = pd.to_numeric(series, errors="coerce")
        bins = [-math.inf, 24, 34, 44, 54, math.inf]
        labels = ["15-24", "25-34", "35-44", "45-54", "55+"]
        series = pd.cut(numeric, bins=bins, labels=labels)
    return _series_to_categorical(series, limit=limit, drop_missing=drop_missing, min_count=min_count)


def _format_percentage(value: float) -> str:
    if pd.isna(value):
        return "0.0%"
    return f"{value:.1f}%"


def _build_categorical_table(
    df: pd.DataFrame,
    topbreak: str,
    variable: str,
    *,
    stat: str,
    limit: int,
    drop_missing: bool,
    min_count: int,
) -> Dict[str, Any]:
    raw_top = df[topbreak]
    raw_var = df[variable]
    top_series = _prepare_topbreak_series(df, topbreak, limit=limit, drop_missing=drop_missing, min_count=min_count)
    var_series = _series_to_categorical(raw_var, limit=limit, drop_missing=drop_missing, min_count=min_count)

    working = pd.DataFrame({"top": top_series, "var": var_series}).dropna()
    if working.empty:
        raise ValueError("No overlapping records for the selected fields")

    top_categories = list(dict.fromkeys(working["top"].tolist()))
    var_categories = list(dict.fromkeys(working["var"].tolist()))

    counts = pd.crosstab(working["top"], working["var"], dropna=False)
    counts = counts.reindex(index=top_categories, columns=var_categories, fill_value=0)

    totals = counts.values.sum()
    row_pct = counts.div(counts.sum(axis=1).replace(0, np.nan), axis=0) * 100
    col_pct = counts.div(counts.sum(axis=0).replace(0, np.nan), axis=1) * 100
    total_pct = (counts / totals * 100) if totals else counts * 0

    display = pd.DataFrame(index=counts.index)
    for column in counts.columns:
        display[f"{column} (count)"] = counts[column]
        display[f"{column} (row%)"] = row_pct[column].map(_format_percentage)
    display["Total (count)"] = counts.sum(axis=1)
    display["Total (row%)"] = "100.0%"
    display.insert(0, topbreak, counts.index)

    gt_table = GT(display.reset_index(drop=True))
    gt_table = gt_table.tab_header(title=f"{variable} by {topbreak}", subtitle=f"Statistic: {stat}")
    gt_table = gt_table.opt_row_striping()
    html = gt_table.to_html()

    stat_matrix = {
        "counts": counts,
        "rowpct": row_pct,
        "colpct": col_pct,
        "totalpct": total_pct,
    }[stat]

    chart_series = []
    for column in stat_matrix.columns:
        points = []
        for category in stat_matrix.index:
            value = float(stat_matrix.loc[category, column])
            points.append({"x": str(category), "y": value})
        chart_series.append({"name": str(column), "data": points})

    chart = {
        "kind": "stacked_bar",
        "x": topbreak,
        "series": chart_series,
        "labels": {
            "x": topbreak,
            "y": "Percent" if stat != "counts" else "Count",
        },
    }

    notes: List[str] = []
    if raw_var.dropna().nunique() > len(set(var_series)):
        notes.append(f"Variable categories limited to top {limit}")
    if raw_top.dropna().nunique() > len(set(top_series)):
        notes.append(f"Top break categories limited to top {limit}")

    meta = {
        "topbreak": topbreak,
        "variable": variable,
        "n": int(totals),
        "stat": stat,
        "notes": notes,
    }

    return {"html": html, "chart": chart, "meta": meta}


def _build_numeric_table(
    df: pd.DataFrame,
    topbreak: str,
    variable: str,
    *,
    limit: int,
    drop_missing: bool,
    min_count: int,
    bins: int,
) -> Dict[str, Any]:
    top_series = _prepare_topbreak_series(df, topbreak, limit=limit, drop_missing=drop_missing, min_count=min_count)
    numeric_series = pd.to_numeric(df[variable], errors="coerce")
    working = pd.DataFrame({"top": top_series, "value": numeric_series}).dropna()

    if working.empty:
        raise ValueError("No numeric values available for the selected fields")

    grouped = working.groupby("top")["value"]
    summary = grouped.agg(["count", "mean", "median", "std"]).reset_index()
    summary["std"] = summary["std"].fillna(0.0)

    summary_display = summary.copy()
    summary_display["mean"] = summary_display["mean"].map(lambda value: f"{value:.2f}")
    summary_display["median"] = summary_display["median"].map(lambda value: f"{value:.2f}")
    summary_display["std"] = summary_display["std"].map(lambda value: f"{value:.2f}")

    gt_table = GT(summary_display)
    gt_table = gt_table.tab_header(title=f"{variable} summary by {topbreak}")
    gt_table = gt_table.opt_row_striping()
    html = gt_table.to_html()

    chart_series = [
        {
            "name": "mean",
            "data": [
                {"x": str(row["top"]), "y": float(row["mean"]), "error": float(row["std"])}
                for _, row in summary.iterrows()
            ],
        }
    ]

    histogram = None
    valid_values = working["value"].dropna()
    if not valid_values.empty:
        bin_edges = np.histogram_bin_edges(valid_values, bins=bins)
        histogram_series = []
        labels = [f"{bin_edges[i]:.1f}–{bin_edges[i + 1]:.1f}" for i in range(len(bin_edges) - 1)]
        for category, group in working.groupby("top"):
            counts, _ = np.histogram(group["value"], bins=bin_edges)
            histogram_series.append(
                {
                    "name": str(category),
                    "data": [
                        {"x": labels[i], "y": int(counts[i])}
                        for i in range(len(counts))
                    ],
                }
            )
        histogram = {
            "kind": "hist",
            "x": "value_bin",
            "series": histogram_series,
            "labels": {"x": "Value bin", "y": "Count"},
        }

    chart = {
        "kind": "grouped_bar",
        "x": topbreak,
        "series": chart_series,
        "labels": {"x": topbreak, "y": f"Mean {variable}"},
    }
    if histogram:
        chart["histogram"] = histogram

    meta = {
        "topbreak": topbreak,
        "variable": variable,
        "n": int(len(valid_values)),
        "stat": "summary",
        "notes": [f"Histogram computed with {bins} bins"],
    }

    return {"html": html, "chart": chart, "meta": meta}


def _build_single_categorical(df: pd.DataFrame, variable: str, *, limit: int, drop_missing: bool, min_count: int) -> Dict[str, Any]:
    series = _series_to_categorical(df[variable], limit=limit, drop_missing=drop_missing, min_count=min_count)
    if series.empty:
        raise ValueError("No records available for the selected variable")

    counts = series.value_counts()
    percentages = counts / counts.sum() * 100
    display = pd.DataFrame({
        variable: counts.index,
        "count": counts.values,
        "percent": percentages.map(_format_percentage),
    })

    gt_table = GT(display)
    gt_table = gt_table.tab_header(title=f"Distribution of {variable}")
    gt_table = gt_table.opt_row_striping()
    html = gt_table.to_html()

    chart_series = [
        {
            "name": "count",
            "data": [
                {"x": str(index), "y": int(value)}
                for index, value in counts.items()
            ],
        }
    ]

    chart = {
        "kind": "bar",
        "x": variable,
        "series": chart_series,
        "labels": {"x": variable, "y": "Count"},
    }

    meta = {
        "topbreak": None,
        "variable": variable,
        "n": int(counts.sum()),
        "stat": "counts",
        "notes": [],
    }

    return {"html": html, "chart": chart, "meta": meta}


def _schema_response() -> Dict[str, Any]:
    df = _load_dataset()
    fields = _DATA_CACHE.get("fields") or _infer_fields(df)
    categorical_candidates = [
        field["name"]
        for field in fields
        if field["type"] == "categorical" and field["distinct_count"] <= 30
    ]
    numeric_candidates = [field["name"] for field in fields if field["type"] == "numeric"]

    available_field_names = {field["name"] for field in fields}
    curated = [key for key in CURATED_TOP_BREAKS if key in available_field_names]
    auto = set(categorical_candidates)
    topbreak_candidates = curated + sorted(candidate for candidate in auto if candidate not in curated)

    payload = {
        "fields": fields,
        "topbreak_candidates": topbreak_candidates,
        "numeric_candidates": numeric_candidates,
        "categorical_candidates": categorical_candidates,
    }
    return _json_response(payload)


def _parse_bool(value: Optional[str], default: bool) -> bool:
    if value is None:
        return default
    value_lower = value.lower()
    if value_lower in {"1", "true", "yes"}:
        return True
    if value_lower in {"0", "false", "no"}:
        return False
    return default


def _table_response(params: Dict[str, str]) -> Dict[str, Any]:
    df = _load_dataset()
    if df.empty:
        return _json_response({"error": "Dataset is empty"}, status=400)

    topbreak = params.get("topbreak")
    variable = params.get("variable")
    if not variable:
        return _json_response({"error": "variable parameter is required"}, status=400)

    stat = params.get("stat", DEFAULT_STAT)
    if stat not in _ALLOWED_STATS:
        return _json_response({"error": f"Unsupported stat '{stat}'"}, status=400)

    try:
        limit = int(params.get("limit_categories", DEFAULT_LIMIT_CATEGORIES))
    except (TypeError, ValueError):
        limit = DEFAULT_LIMIT_CATEGORIES

    try:
        bins = int(params.get("bins", DEFAULT_BINS))
    except (TypeError, ValueError):
        bins = DEFAULT_BINS

    try:
        min_count = int(params.get("min_count", DEFAULT_MIN_COUNT))
    except (TypeError, ValueError):
        min_count = DEFAULT_MIN_COUNT

    drop_missing = _parse_bool(params.get("drop_missing"), True)
    try:
        take = int(params.get("take", "0"))
    except (TypeError, ValueError):
        take = 0
    if take > 0:
        df = df.head(take)

    fields_lookup = {field["name"]: field for field in (_DATA_CACHE.get("fields") or _infer_fields(df))}
    if variable not in fields_lookup:
        return _json_response({"error": f"Unknown variable '{variable}'"}, status=400)

    if topbreak and topbreak not in df.columns:
        return _json_response({"error": f"Unknown top break '{topbreak}'"}, status=400)

    try:
        if topbreak:
            if fields_lookup[variable]["type"] == "numeric":
                payload = _build_numeric_table(
                    df,
                    topbreak,
                    variable,
                    limit=limit,
                    drop_missing=drop_missing,
                    min_count=min_count,
                    bins=bins,
                )
            else:
                payload = _build_categorical_table(
                    df,
                    topbreak,
                    variable,
                    stat=stat,
                    limit=limit,
                    drop_missing=drop_missing,
                    min_count=min_count,
                )
        else:
            payload = _build_single_categorical(
                df,
                variable,
                limit=limit,
                drop_missing=drop_missing,
                min_count=min_count,
            )
    except ValueError as exc:
        return _json_response({"error": str(exc)}, status=400)

    return _json_response(payload)


def handler(event, _context):
    path = event.get("path", "")
    if path.endswith("/schema"):
        return _schema_response()

    params = event.get("queryStringParameters") or {}
    return _table_response(params)
