import React, { useState, useCallback } from 'react'
import { Snackbar } from './ui'
import { softDeleteTransaction, restoreTransaction } from '../data/transactions'

/** Soft-delete a transaction and offer Undo. Returns [requestDelete, <Snackbar/>]. */
export default function useDeleteWithUndo() {
  const [deleted, setDeleted] = useState(null)

  const requestDelete = useCallback(async (tx) => {
    await softDeleteTransaction(tx)
    setDeleted(tx)
  }, [])

  const dismiss = useCallback(() => setDeleted(null), [])
  const undo = useCallback(async () => {
    if (deleted) await restoreTransaction(deleted)
    setDeleted(null)
  }, [deleted])

  const node = (
    <Snackbar
      message={deleted ? 'Transaction deleted' : null}
      actionLabel="Undo"
      onAction={undo}
      onDismiss={dismiss}
    />
  )
  return [requestDelete, node]
}
