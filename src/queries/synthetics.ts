export const SYNTHETIC_MONITORS_LIST_QUERY = `
  query SyntheticMonitorsList($cursor: String) {
    actor {
      entitySearch(query: "domain = 'SYNTH' AND type = 'MONITOR'") {
        results(cursor: $cursor) {
          entities {
            guid
            name
            ... on SyntheticMonitorEntityOutline {
              monitorId
              monitorType
              period
              status
            }
          }
          nextCursor
        }
        count
      }
    }
  }
`;

export const SYNTHETIC_MONITOR_GET_QUERY = `
  query SyntheticMonitorGet($guid: EntityGuid!) {
    actor {
      entity(guid: $guid) {
        guid
        name
        ... on SyntheticMonitorEntity {
          monitorId
          monitorType
          period
          status
          tags {
            key
            values
          }
        }
      }
    }
  }
`;

export const SYNTHETIC_SIMPLE_MONITOR_CREATE_MUTATION = `
  mutation SyntheticSimpleMonitorCreate($accountId: Int!, $monitor: SyntheticsCreateSimpleBrowserMonitorInput!) {
    syntheticsCreateSimpleBrowserMonitor(accountId: $accountId, monitor: $monitor) {
      monitor {
        guid
        name
        status
        period
      }
      errors {
        description
        type
      }
    }
  }
`;

export const SYNTHETIC_SCRIPTED_BROWSER_MONITOR_CREATE_MUTATION = `
  mutation SyntheticScriptedBrowserMonitorCreate($accountId: Int!, $monitor: SyntheticsCreateScriptBrowserMonitorInput!) {
    syntheticsCreateScriptBrowserMonitor(accountId: $accountId, monitor: $monitor) {
      monitor {
        guid
        name
        status
        period
      }
      errors {
        description
        type
      }
    }
  }
`;

export const SYNTHETIC_SCRIPTED_API_MONITOR_CREATE_MUTATION = `
  mutation SyntheticScriptedApiMonitorCreate($accountId: Int!, $monitor: SyntheticsCreateScriptApiMonitorInput!) {
    syntheticsCreateScriptApiMonitor(accountId: $accountId, monitor: $monitor) {
      monitor {
        guid
        name
        status
        period
      }
      errors {
        description
        type
      }
    }
  }
`;

export const SYNTHETIC_SIMPLE_MONITOR_UPDATE_MUTATION = `
  mutation SyntheticSimpleMonitorUpdate($guid: EntityGuid!, $monitor: SyntheticsUpdateSimpleBrowserMonitorInput!) {
    syntheticsUpdateSimpleBrowserMonitor(guid: $guid, monitor: $monitor) {
      monitor {
        guid
        name
        status
        period
      }
      errors {
        description
        type
      }
    }
  }
`;

export const SYNTHETIC_SCRIPTED_BROWSER_MONITOR_UPDATE_MUTATION = `
  mutation SyntheticScriptedBrowserMonitorUpdate($guid: EntityGuid!, $monitor: SyntheticsUpdateScriptBrowserMonitorInput!) {
    syntheticsUpdateScriptBrowserMonitor(guid: $guid, monitor: $monitor) {
      monitor {
        guid
        name
        status
        period
      }
      errors {
        description
        type
      }
    }
  }
`;

export const SYNTHETIC_SCRIPTED_API_MONITOR_UPDATE_MUTATION = `
  mutation SyntheticScriptedApiMonitorUpdate($guid: EntityGuid!, $monitor: SyntheticsUpdateScriptApiMonitorInput!) {
    syntheticsUpdateScriptApiMonitor(guid: $guid, monitor: $monitor) {
      monitor {
        guid
        name
        status
        period
      }
      errors {
        description
        type
      }
    }
  }
`;

export const SYNTHETIC_MONITOR_DELETE_MUTATION = `
  mutation SyntheticMonitorDelete($guid: EntityGuid!) {
    syntheticsDeleteMonitor(guid: $guid) {
      deletedGuid
    }
  }
`;

export const SYNTHETIC_PRIVATE_LOCATIONS_QUERY = `
  query SyntheticPrivateLocations($accountId: Int!) {
    actor {
      account(id: $accountId) {
        synthetics {
          privateLocations {
            guid
            name
            description
            locationId
          }
        }
      }
    }
  }
`;

export const SYNTHETIC_SECURE_CREDENTIAL_LIST_QUERY = `
  query SyntheticSecureCredentialList($accountId: Int!, $cursor: String) {
    actor {
      account(id: $accountId) {
        synthetics {
          secureCredentials(cursor: $cursor) {
            secureCredentials {
              key
              description
              createdAt
              updatedAt
            }
            nextCursor
          }
        }
      }
    }
  }
`;

export const SYNTHETIC_SECURE_CREDENTIAL_CREATE_MUTATION = `
  mutation SyntheticSecureCredentialCreate($accountId: Int!, $secureCredential: SyntheticsSecureCredentialInput!) {
    syntheticsUpsertSecureCredential(accountId: $accountId, secureCredential: $secureCredential) {
      createdAt
      updatedAt
      errors {
        description
        type
      }
    }
  }
`;

export const SYNTHETIC_SECURE_CREDENTIAL_DELETE_MUTATION = `
  mutation SyntheticSecureCredentialDelete($accountId: Int!, $key: String!) {
    syntheticsDeleteSecureCredential(accountId: $accountId, key: $key) {
      errors {
        description
        type
      }
    }
  }
`;
