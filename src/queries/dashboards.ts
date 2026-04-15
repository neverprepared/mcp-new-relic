export const DASHBOARDS_LIST_QUERY = `
  query DashboardsList($cursor: String) {
    actor {
      entitySearch(query: "type = 'DASHBOARD'") {
        results(cursor: $cursor) {
          entities {
            guid
            name
            ... on DashboardEntityOutline {
              createdAt
              updatedAt
              permissions
              owner {
                email
                userId
              }
            }
          }
          nextCursor
        }
        count
      }
    }
  }
`;

export const DASHBOARD_GET_QUERY = `
  query DashboardGet($guid: EntityGuid!) {
    actor {
      entity(guid: $guid) {
        guid
        name
        ... on DashboardEntity {
          createdAt
          updatedAt
          permissions
          owner {
            email
            userId
          }
          pages {
            guid
            name
            description
            widgets {
              id
              title
              layout {
                row
                column
                height
                width
              }
              rawConfiguration
            }
          }
        }
      }
    }
  }
`;

export const DASHBOARD_CREATE_MUTATION = `
  mutation DashboardCreate($accountId: Int!, $dashboard: DashboardInput!) {
    dashboardCreate(accountId: $accountId, dashboard: $dashboard) {
      entityResult {
        guid
        name
        createdAt
        updatedAt
        permissions
      }
      errors {
        description
        type
      }
    }
  }
`;

export const DASHBOARD_UPDATE_MUTATION = `
  mutation DashboardUpdate($guid: EntityGuid!, $dashboard: DashboardInput!) {
    dashboardUpdate(guid: $guid, dashboard: $dashboard) {
      entityResult {
        guid
        name
        createdAt
        updatedAt
        permissions
      }
      errors {
        description
        type
      }
    }
  }
`;

export const DASHBOARD_DELETE_MUTATION = `
  mutation DashboardDelete($guid: EntityGuid!) {
    dashboardDelete(guid: $guid) {
      status
      errors {
        description
        type
      }
    }
  }
`;
