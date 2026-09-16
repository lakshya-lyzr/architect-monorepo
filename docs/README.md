# Documentation

| Section                        | Contents                                                             |
| ------------------------------ | -------------------------------------------------------------------- |
| [Frontend](frontend/README.md) | Next.js, generated queries, proxy configuration, and frontend checks |
| [Backend](backend/README.md)   | Huma endpoints, OpenAPI export, Go configuration, and backend checks |
| [Common](common/README.md)     | Nx task dependencies, development workflow, and pre-commit hooks     |

Keep frontend-specific guidance in `frontend/`, backend-specific guidance in
`backend/`, and cross-application guidance in `common/`.

For installation and startup, see the [root README](../README.md).

Documentation-only changes still run CI automation tests, but skip frontend and
backend application checks. See the [CI guide](common/README.md#continuous-integration).
