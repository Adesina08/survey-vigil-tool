from __future__ import annotations

import random
from datetime import datetime
from typing import Dict, Iterable, List

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from great_tables import GT

app = Flask(__name__)
CORS(app)

rng = random.Random(42)
np_rng = np.random.default_rng(42)

MULTI_SELECT_COLUMNS = {
    "B4_SupportType",
    "C2_TrainingType",
    "C8_Barriers",
    "D2_EnterpriseType",
    "D6_OGSTEPInputs",
    "E2_Sector",
    "E9_Constraints",
    "G3_GroupMember",
    "H4_Risks",
}

ORDINAL_COLUMNS = {
    "H1_Satisfaction": ["1 - Very dissatisfied", "2", "3", "4", "5 - Very satisfied"],
    "H2_Trust": ["1 - Very low", "2", "3", "4", "5 - Very high"],
    "F1_WorryFood": ["Never", "Rarely", "Sometimes", "Often"],
    "F2_SmallerMeals": ["Never", "Rarely", "Sometimes", "Often"],
    "F3_FewerMeals": ["Never", "Rarely", "Sometimes", "Often"],
    "F4_SleptHungry": ["Never", "Rarely", "Sometimes", "Often"],
    "F5_NoFood": ["Never", "Rarely", "Sometimes", "Often"],
    "F6_FoodSituation": ["Worsened", "Stayed the same", "Improved"],
}

PATH_COLOURS = {
    "treatment": "#2563eb",  # blue
    "control": "#16a34a",  # green
    "common": "#7c3aed",  # purple
    "validation": "#f59e0b",  # amber
}

LABEL_MAP: Dict[str, str] = {
    "A3_LGA": "A3. LGA / Ward",
    "A6_Consent": "A6. Consent",
    "A7_Sex": "A7. Sex",
    "A9_MaritalStatus": "A9. Marital status",
    "A10_Education": "A10. Highest education",
    "A12_EnumeratorObservation": "A12. Enumerator observation",
    "B1_Awareness": "B1. Awareness of OGSTEP",
    "B2_Participation": "B2. Participated in OGSTEP",
    "B4_SupportType": "B4. Support type received",
    "B6_OtherPrograms": "B6. Joined other programs",
    "B7_ProgramName": "B7. Program name",
    "C1_OGSTEPTrainingCompleted": "C1. Completed OGSTEP training",
    "C2_TrainingType": "C2. Type of OGSTEP training",
    "C3_NonOGSTEPTraining": "C3. Non-OGSTEP training",
    "C4_EmploymentStatus": "C4. Employment status",
    "C7_JobRelated": "C7. Job related to training",
    "C8_Barriers": "C8. Barriers to finding work",
    "D1_CurrentlyFarm": "D1. Currently farming",
    "D2_EnterpriseType": "D2. Enterprise type",
    "D6_OGSTEPInputs": "D6. Inputs received via OGSTEP",
    "D7_OtherInputs": "D7. Inputs from other sources",
    "D11_OffTaker": "D11. Off-taker contracts",
    "E1_OwnBusiness": "E1. Own business",
    "E2_Sector": "E2. Business sector",
    "E6_OGSTEPFinance": "E6. Received OGSTEP finance",
    "E7_OtherSupport": "E7. Received other support",
    "E8_NewTechnology": "E8. Adopted new technology",
    "E9_Constraints": "E9. Constraints to growth",
    "F1_WorryFood": "F1. Worried about food",
    "F2_SmallerMeals": "F2. Took smaller meals",
    "F3_FewerMeals": "F3. Fewer meals",
    "F4_SleptHungry": "F4. Slept hungry",
    "F5_NoFood": "F5. Whole day without food",
    "F6_FoodSituation": "F6. Food situation change",
    "G1_IncomeDecisions": "G1. Who decides income",
    "G2_SavingsCredit": "G2. Has savings/credit",
    "G3_GroupMember": "G3. Group membership",
    "G4_Influence": "G4. Influence compared to before",
    "H1_Satisfaction": "H1. Satisfaction with OGSTEP",
    "H2_Trust": "H2. Trust in institutions",
    "H3_ContinueWithoutSupport": "H3. Continue without support",
    "H4_Risks": "H4. Risks to sustain benefits",
}

PATH_LABELS = {
    "treatment": "Treatment",
    "control": "Control",
    "common": "Common",
    "validation": "Validation",
}


def _pick_many(options: Iterable[str], minimum: int = 1, maximum: int | None = None) -> List[str]:
    opts = list(options)
    if not opts:
        return []
    if maximum is None:
        maximum = len(opts)
    k = rng.randint(minimum, maximum)
    return sorted(rng.sample(opts, k))


def create_mock_dataframe(rows: int = 220) -> pd.DataFrame:
    lgas = [
        "Abeokuta North",
        "Abeokuta South",
        "Ado-Odo/Ota",
        "Ijebu Ode",
        "Ijebu North",
        "Obafemi Owode",
    ]
    enumerator_obs = ["High", "Moderate", "Low"]
    marital = ["Single", "Married", "Divorced", "Widowed"]
    education = ["None", "Primary", "Secondary", "Vocational", "Tertiary"]
    consent = ["Yes", "No"]
    sex = ["Male", "Female", "Other"]

    program_names = ["OGSTEP", "N-Power", "Fadama", "YouWin", "Private accelerator"]
    employment_status = ["Wage employment", "Self-employed", "Apprentice", "Unemployed"]
    training_types = ["Automobile", "Electrical", "Tailoring", "ICT", "Agric"]
    barriers = ["Jobs not available", "Skills mismatch", "Lack of capital", "Family responsibilities", "Other"]
    enterprise_types = ["Poultry", "Cassava", "Maize", "Vegetables", "Aquaculture"]
    inputs = ["Seeds", "Fertiliser", "Vet services", "Mechanisation", "Tools"]
    other_inputs = ["Self-financed", "NGO", "Government", "Private buyer"]
    sectors = ["Agro-processing", "Manufacturing", "Services", "Trade"]
    constraints = ["Finance", "Inputs", "Regulation", "Demand", "Other"]
    group_member = ["Men", "Women", "Youth"]
    risks = ["Finance", "Political", "Market", "Community", "Other"]
    influence = ["Much more", "Somewhat more", "No change", "Less able"]
    continue_support = ["Yes", "No", "Unsure"]

    data = []
    for idx in range(rows):
        path = np_rng.choice(["treatment", "control", "common", "validation"], p=[0.35, 0.3, 0.25, 0.1])
        record = {
            "SubmissionID": f"RESP-{idx+1:04d}",
            "survey_path": path,
            "A3_LGA": rng.choice(lgas),
            "A6_Consent": rng.choice(consent),
            "A7_Sex": rng.choice(sex),
            "A9_MaritalStatus": rng.choice(marital),
            "A10_Education": rng.choice(education),
            "A12_EnumeratorObservation": rng.choice(enumerator_obs),
            "B1_Awareness": rng.choice(["Yes", "No"]),
            "B2_Participation": rng.choice(["Yes", "No"]),
            "B4_SupportType": _pick_many(["Training", "Finance", "Inputs", "Market", "Other"], 1, 3),
            "B6_OtherPrograms": rng.choice(["Yes", "No"]),
            "B7_ProgramName": rng.choice(program_names),
            "C1_OGSTEPTrainingCompleted": rng.choice(["Yes", "No"]),
            "C2_TrainingType": _pick_many(training_types, 1, 3),
            "C3_NonOGSTEPTraining": rng.choice(["Yes", "No"]),
            "C4_EmploymentStatus": rng.choice(employment_status),
            "C7_JobRelated": rng.choice(["Yes", "No"]),
            "C8_Barriers": _pick_many(barriers, 1, 3),
            "D1_CurrentlyFarm": rng.choice(["Yes", "No"]),
            "D2_EnterpriseType": _pick_many(enterprise_types, 1, 2),
            "D6_OGSTEPInputs": _pick_many(inputs, 1, 3),
            "D7_OtherInputs": rng.choice(other_inputs),
            "D11_OffTaker": rng.choice(["Yes", "No"]),
            "E1_OwnBusiness": rng.choice(["Yes", "No"]),
            "E2_Sector": _pick_many(sectors, 1, 2),
            "E6_OGSTEPFinance": rng.choice(["Yes", "No"]),
            "E7_OtherSupport": rng.choice(["Yes", "No"]),
            "E8_NewTechnology": rng.choice(["Yes", "No"]),
            "E9_Constraints": _pick_many(constraints, 1, 3),
            "F1_WorryFood": rng.choice(ORDINAL_COLUMNS["F1_WorryFood"]),
            "F2_SmallerMeals": rng.choice(ORDINAL_COLUMNS["F2_SmallerMeals"]),
            "F3_FewerMeals": rng.choice(ORDINAL_COLUMNS["F3_FewerMeals"]),
            "F4_SleptHungry": rng.choice(ORDINAL_COLUMNS["F4_SleptHungry"]),
            "F5_NoFood": rng.choice(ORDINAL_COLUMNS["F5_NoFood"]),
            "F6_FoodSituation": rng.choice(ORDINAL_COLUMNS["F6_FoodSituation"]),
            "G1_IncomeDecisions": rng.choice(["Self", "Spouse", "Joint", "Other"]),
            "G2_SavingsCredit": rng.choice(["Yes", "No"]),
            "G3_GroupMember": _pick_many(group_member, 1, 2),
            "G4_Influence": rng.choice(influence),
            "H1_Satisfaction": rng.choice(ORDINAL_COLUMNS["H1_Satisfaction"]),
            "H2_Trust": rng.choice(ORDINAL_COLUMNS["H2_Trust"]),
            "H3_ContinueWithoutSupport": rng.choice(continue_support),
            "H4_Risks": _pick_many(risks, 1, 3),
        }

        data.append(record)

    df = pd.DataFrame(data)
    for column, order in ORDINAL_COLUMNS.items():
        if column in df.columns:
            df[column] = pd.Categorical(df[column], categories=order, ordered=True)
    return df


def explode_columns(df: pd.DataFrame, columns: Iterable[str]) -> pd.DataFrame:
    result = df.copy()
    for column in columns:
        if column in MULTI_SELECT_COLUMNS and column in result.columns:
            result = result.explode(column)
    drop_columns = [column for column in columns if column in MULTI_SELECT_COLUMNS]
    if drop_columns:
        result = result.dropna(subset=drop_columns)
    return result


def format_table(df: pd.DataFrame, side_break: str, top_breaks: List[str], mode: str) -> str:
    display_df = df.reset_index().fillna(0)
    if isinstance(display_df.columns, pd.MultiIndex):
        display_df.columns = [" | ".join(str(level) for level in column if level != "") for column in display_df.columns]

    side_label = LABEL_MAP.get(side_break, side_break)
    if side_label not in display_df.columns:
        display_df.rename(columns={"index": side_label, side_break: side_label}, inplace=True)

    # Format percentages directly in the dataframe to avoid missing formatter support.
    if mode != "count":
        metric_columns = [col for col in display_df.columns if col != side_label]
        for column in metric_columns:
            display_df[column] = display_df[column].apply(
                lambda value: f"{value:.1f}%" if isinstance(value, (float, np.floating)) else value
            )
    else:
        metric_columns = [col for col in display_df.columns if col != side_label]
        for column in metric_columns:
            display_df[column] = display_df[column].apply(
                lambda value: int(value) if isinstance(value, (float, np.floating)) else value
            )

    subtitle = " + ".join(LABEL_MAP.get(col, col) for col in top_breaks) if top_breaks else "Overall distribution"

    table = (
        GT(display_df)
        .tab_header(title=side_label, subtitle=subtitle)
        .tab_source_note(f"Generated {datetime.utcnow():%d %b %Y %H:%M} UTC")
    )

    return table.as_html()


def build_crosstab(
    dataframe: pd.DataFrame,
    side_break: str,
    top_breaks: List[str],
    mode: str,
) -> pd.DataFrame:
    normalize_map = {
        "count": None,
        "rowPercent": "index",
        "columnPercent": "columns",
        "totalPercent": "all",
    }
    prepared = explode_columns(dataframe, [side_break, *top_breaks])
    normalize = normalize_map.get(mode, None)

    top_arrays = [prepared[top] for top in top_breaks] if top_breaks else None
    crosstab = pd.crosstab(
        index=prepared[side_break],
        columns=top_arrays if top_arrays else [],
        normalize=normalize,
        margins=True,
        margins_name="Total",
        dropna=False,
    )

    if mode != "count":
        crosstab = (crosstab * 100).round(1)

    if isinstance(crosstab.columns, pd.MultiIndex):
        crosstab.columns = [
            " | ".join(str(level) for level in column if level not in ("", "None"))
            for column in crosstab.columns
        ]
    if isinstance(crosstab.index, pd.MultiIndex):
        crosstab.index = [
            " | ".join(str(level) for level in index if level not in ("", "None"))
            for index in crosstab.index
        ]

    return crosstab


def build_chart_payload(dataframe: pd.DataFrame, side_break: str, paths: List[str]) -> Dict[str, object] | None:
    if not paths:
        return None
    relevant_paths = [path for path in paths if path in ("treatment", "control")]
    if len(relevant_paths) < 1:
        return None

    prepared = explode_columns(dataframe, [side_break])
    grouped = prepared.groupby(["survey_path", side_break]).size().reset_index(name="count")
    grouped = grouped[grouped["survey_path"].isin(relevant_paths)]
    if grouped.empty:
        return None
    totals = grouped.groupby("survey_path")["count"].transform("sum")
    grouped["percent"] = (grouped["count"] / totals * 100).round(1)

    labels = list(dict.fromkeys(grouped[side_break].astype(str)))
    datasets = []
    for path in relevant_paths:
        subset = grouped[grouped["survey_path"] == path]
        values = []
        for label in labels:
            match = subset[subset[side_break].astype(str) == label]
            if match.empty:
                values.append(0.0)
            else:
                values.append(float(match.iloc[0]["percent"]))
        datasets.append(
            {
                "label": PATH_LABELS.get(path, path),
                "backgroundColor": PATH_COLOURS.get(path, "#475569"),
                "data": values,
            }
        )

    return {
        "sideBreak": LABEL_MAP.get(side_break, side_break),
        "labels": labels,
        "datasets": datasets,
    }


def build_insights(chart_payload: Dict[str, object] | None, mode: str) -> List[str]:
    insights: List[str] = []
    if not chart_payload:
        return insights

    labels = chart_payload.get("labels", [])
    datasets = chart_payload.get("datasets", [])
    if not labels or not datasets or len(datasets) < 2:
        return insights

    treatment = datasets[0]
    control = datasets[1]
    treatment_values = treatment.get("data", [])
    control_values = control.get("data", [])

    if not treatment_values or not control_values:
        return insights

    differences = [t - c for t, c in zip(treatment_values, control_values)]
    if not differences:
        return insights

    max_idx = int(np.argmax(np.abs(differences)))
    label = labels[max_idx]
    delta = differences[max_idx]
    comparator = "higher" if delta > 0 else "lower"
    insights.append(
        f"Treatment group shows {abs(delta):.1f} percentage points {comparator} {label.lower()} compared with the control group."
    )
    insights.append(
        "Column percentages allow stakeholders to compare programme reach between pathways regardless of sample size differences."
    )
    if mode == "count":
        insights.append("Switch to Row % or Total % to normalise for different respondent bases across banners.")
    else:
        insights.append("Download the crosstab to slice deeper by demographics or support type combinations.")

    return insights


SURVEY_DATAFRAME = create_mock_dataframe()


@app.route("/generate_table", methods=["POST"])
def generate_table():
    payload = request.get_json(force=True)
    top_breaks = payload.get("topBreaks", [])
    side_breaks = payload.get("sideBreaks", [])
    mode = payload.get("mode", "count")
    selected_paths = payload.get("paths", list(PATH_LABELS.keys()))

    if not side_breaks:
        side_breaks = ["B2_Participation"]
    if not top_breaks:
        top_breaks = ["A7_Sex"]

    filtered_df = SURVEY_DATAFRAME[SURVEY_DATAFRAME["survey_path"].isin(selected_paths)]

    tables = []
    for side in side_breaks:
        crosstab = build_crosstab(filtered_df, side, top_breaks, mode)
        html = format_table(crosstab, side, top_breaks, mode)
        title_suffix = " + ".join(LABEL_MAP.get(tb, tb) for tb in top_breaks) if top_breaks else "Overall"
        tables.append(
            {
                "sideBreak": side,
                "title": f"{LABEL_MAP.get(side, side)} vs. {title_suffix}",
                "html": html,
                "mode": mode,
            }
        )

    chart_payload = build_chart_payload(filtered_df, side_breaks[0], selected_paths)
    insights = build_insights(chart_payload, mode)

    response = {
        "tables": tables,
        "chart": chart_payload,
        "insights": insights,
        "metadata": {
            "rowCount": int(filtered_df.shape[0]),
            "appliedFilters": [
                "Paths: " + ", ".join(PATH_LABELS.get(path, path) for path in selected_paths),
                "Display: " + mode,
                "Top breaks: " + ", ".join(LABEL_MAP.get(tb, tb) for tb in top_breaks),
            ],
        },
    }
    return jsonify(response)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
