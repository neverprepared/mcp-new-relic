export const ALERT_POLICIES_LIST_QUERY = `
  query AlertPoliciesList($accountId: Int!, $cursor: String) {
    actor {
      account(id: $accountId) {
        alerts {
          policiesSearch(cursor: $cursor) {
            policies {
              id
              name
              incidentPreference
            }
            nextCursor
            totalCount
          }
        }
      }
    }
  }
`;

export const ALERT_POLICY_GET_QUERY = `
  query AlertPolicyGet($accountId: Int!, $id: ID!) {
    actor {
      account(id: $accountId) {
        alerts {
          policiesSearch(searchCriteria: { ids: [$id] }) {
            policies {
              id
              name
              incidentPreference
            }
          }
        }
      }
    }
  }
`;

export const ALERT_POLICY_CREATE_MUTATION = `
  mutation AlertPolicyCreate($accountId: Int!, $policy: AlertsPolicyInput!) {
    alertsPolicyCreate(accountId: $accountId, policy: $policy) {
      id
      name
      incidentPreference
    }
  }
`;

export const ALERT_POLICY_UPDATE_MUTATION = `
  mutation AlertPolicyUpdate($accountId: Int!, $id: ID!, $policy: AlertsPolicyUpdateInput!) {
    alertsPolicyUpdate(accountId: $accountId, id: $id, policy: $policy) {
      id
      name
      incidentPreference
    }
  }
`;

export const ALERT_POLICY_DELETE_MUTATION = `
  mutation AlertPolicyDelete($accountId: Int!, $id: ID!) {
    alertsPolicyDelete(accountId: $accountId, id: $id) {
      id
    }
  }
`;

export const ALERT_NRQL_CONDITIONS_LIST_QUERY = `
  query AlertNrqlConditionsList($accountId: Int!, $policyId: ID!, $cursor: String) {
    actor {
      account(id: $accountId) {
        alerts {
          nrqlConditionsSearch(
            searchCriteria: { policyId: $policyId }
            cursor: $cursor
          ) {
            nrqlConditions {
              id
              name
              enabled
              policyId
              ... on AlertsNrqlStaticCondition {
                nrql {
                  query
                }
                terms {
                  operator
                  priority
                  threshold
                  thresholdDuration
                  thresholdOccurrences
                }
                violationTimeLimitSeconds
              }
            }
            nextCursor
            totalCount
          }
        }
      }
    }
  }
`;

export const ALERT_NRQL_CONDITION_CREATE_MUTATION = `
  mutation AlertNrqlConditionCreate($accountId: Int!, $policyId: ID!, $condition: AlertsNrqlConditionStaticInput!) {
    alertsNrqlConditionStaticCreate(
      accountId: $accountId
      policyId: $policyId
      condition: $condition
    ) {
      id
      name
      enabled
      policyId
      nrql {
        query
      }
      terms {
        operator
        priority
        threshold
        thresholdDuration
        thresholdOccurrences
      }
    }
  }
`;

export const ALERT_NRQL_CONDITION_UPDATE_MUTATION = `
  mutation AlertNrqlConditionUpdate($accountId: Int!, $conditionId: ID!, $condition: AlertsNrqlConditionStaticInput!) {
    alertsNrqlConditionStaticUpdate(
      accountId: $accountId
      id: $conditionId
      condition: $condition
    ) {
      id
      name
      enabled
      policyId
      nrql {
        query
      }
      terms {
        operator
        priority
        threshold
        thresholdDuration
        thresholdOccurrences
      }
    }
  }
`;

export const ALERT_NRQL_CONDITION_DELETE_MUTATION = `
  mutation AlertNrqlConditionDelete($accountId: Int!, $conditionId: ID!) {
    alertsConditionDelete(accountId: $accountId, id: $conditionId) {
      id
    }
  }
`;

export const ALERT_MUTING_RULES_LIST_QUERY = `
  query AlertMutingRulesList($accountId: Int!) {
    actor {
      account(id: $accountId) {
        alerts {
          mutingRules {
            id
            name
            enabled
            description
            condition {
              operator
              conditions {
                attribute
                operator
                values
              }
            }
            schedule {
              startTime
              endTime
              timeZone
              repeat
              repeatCount
              endRepeat
              weeklyRepeatDays
            }
          }
        }
      }
    }
  }
`;

export const ALERT_MUTING_RULE_CREATE_MUTATION = `
  mutation AlertMutingRuleCreate($accountId: Int!, $rule: AlertsMutingRuleInput!) {
    alertsMutingRuleCreate(accountId: $accountId, rule: $rule) {
      id
      name
      enabled
      description
    }
  }
`;

export const ALERT_MUTING_RULE_UPDATE_MUTATION = `
  mutation AlertMutingRuleUpdate($accountId: Int!, $id: ID!, $rule: AlertsMutingRuleUpdateInput!) {
    alertsMutingRuleUpdate(accountId: $accountId, id: $id, rule: $rule) {
      id
      name
      enabled
      description
    }
  }
`;

export const ALERT_MUTING_RULE_DELETE_MUTATION = `
  mutation AlertMutingRuleDelete($accountId: Int!, $id: ID!) {
    alertsMutingRuleDelete(accountId: $accountId, id: $id) {
      id
    }
  }
`;
