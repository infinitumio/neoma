// SPDX-License-Identifier: AGPL-3.0-or-later

/** Thrown when access to a local folder has been revoked or denied. */
export class PermissionError extends Error {
  constructor(message = 'Folder permission was revoked or denied') {
    super(message)
    this.name = 'PermissionError'
  }
}

/** Thrown when a file changed on disk outside neoma since we last read it. */
export class ConflictError extends Error {
  constructor(
    public readonly path: string,
    public readonly diskContent: string,
  ) {
    super(`File changed outside neoma: ${path}`)
    this.name = 'ConflictError'
  }
}

export class NotFoundError extends Error {
  constructor(path: string) {
    super(`File not found: ${path}`)
    this.name = 'NotFoundError'
  }
}

export class AlreadyExistsError extends Error {
  constructor(path: string) {
    super(`Already exists: ${path}`)
    this.name = 'AlreadyExistsError'
  }
}
