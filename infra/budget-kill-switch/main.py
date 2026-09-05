"""Budget kill switch.

Triggered by Pub/Sub messages from the Cloud Billing budget on this
project. Once actual spend reaches or exceeds the budget amount, this
unlinks the billing account from the project — which immediately stops
every billable service (Cloud Run, Firestore, Vertex AI, etc).

This is a deliberate hard stop, not a soft alert: it causes a full outage
of the project until billing is manually re-linked in the console. See
DEPLOYMENT.md in the main repo for the reasoning.
"""

import base64
import json

import functions_framework
from google.cloud import billing_v1

PROJECT_NAME = "projects/live-caster-75895"


@functions_framework.cloud_event
def disable_billing_if_over_budget(cloud_event):
    data = cloud_event.data["message"]["data"]
    payload = json.loads(base64.b64decode(data).decode("utf-8"))

    cost_amount = payload.get("costAmount", 0)
    budget_amount = payload.get("budgetAmount", 0)
    print(f"Budget notification: cost={cost_amount} budget={budget_amount}")

    if budget_amount <= 0 or cost_amount < budget_amount:
        print("Under budget, no action taken.")
        return

    client = billing_v1.CloudBillingClient()
    billing_info = client.get_project_billing_info(name=PROJECT_NAME)

    if not billing_info.billing_enabled:
        print("Billing already disabled, nothing to do.")
        return

    print(f"Spend {cost_amount} >= budget {budget_amount}. Disabling billing on {PROJECT_NAME}.")
    client.update_project_billing_info(
        name=PROJECT_NAME,
        project_billing_info=billing_v1.ProjectBillingInfo(
            name=PROJECT_NAME,
            billing_account_name="",
        ),
    )
    print(f"Billing disabled for {PROJECT_NAME}.")
