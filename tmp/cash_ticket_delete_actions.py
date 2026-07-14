from pathlib import Path

root = Path(r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$")
frontend = root / "frontend" / "src" / "pages" / "CashTickets" / "CashTicketsPage.jsx"
controller = root / "backend" / "app" / "Http" / "Controllers" / "Api" / "CashTicketController.php"
routes = root / "backend" / "routes" / "api.php"

text = frontend.read_text(encoding="utf-8")
if "  Menu,\n" not in text:
    text = text.replace("""  LinearProgress,\n  MenuItem,\n  Paper,\n""", """  LinearProgress,\n  Menu,\n  MenuItem,\n  Paper,\n""", 1)
if "  MoreVertical,\n" not in text:
    text = text.replace("""  Download,\n  Eye,\n  Pencil,\n  Plus,\n""", """  Download,\n  Eye,\n  MoreVertical,\n  Pencil,\n  Plus,\n""", 1)
if "  Trash2,\n" not in text:
    text = text.replace("""  Save,\n  Ticket,\n""", """  Save,\n  Ticket,\n  Trash2,\n""", 1)
if "collectionActionAnchor" not in text:
    text = text.replace("""  const [editingCollection, setEditingCollection] = useState(null)\n  const [viewingCollection, setViewingCollection] = useState(null)\n""", """  const [editingCollection, setEditingCollection] = useState(null)\n  const [viewingCollection, setViewingCollection] = useState(null)\n  const [collectionActionAnchor, setCollectionActionAnchor] = useState(null)\n  const [collectionActionRow, setCollectionActionRow] = useState(null)\n""", 1)

close_block = """  const closeCollectionDialog = () => {\n    if (saving) return\n    setCollectionDialogOpen(false)\n    setEditingCollection(null)\n    setCollectionForm(emptyCollectionForm)\n  }\n"""
handlers = """\n  const openCollectionActionMenu = (event, row) => {\n    setCollectionActionAnchor(event.currentTarget)\n    setCollectionActionRow(row)\n  }\n\n  const closeCollectionActionMenu = () => {\n    setCollectionActionAnchor(null)\n    setCollectionActionRow(null)\n  }\n\n  const runCollectionAction = (handler) => {\n    const row = collectionActionRow\n    closeCollectionActionMenu()\n    if (row) handler(row)\n  }\n\n  const deleteCollection = async (row) => {\n    const dateLabel = row.remittance_date || row.collection_date || '-'\n    const collectorLabel = row.collector_name || 'collector'\n    if (!window.confirm(`Delete cash ticket remittance for ${collectorLabel} on ${dateLabel}?`)) {\n      return\n    }\n\n    setSaving('collection-delete')\n    setError('')\n    setMessage('')\n    try {\n      await axiosInstance.delete(`/cash-tickets/collections/${row.id}`)\n      setMessage('Cash ticket remittance deleted.')\n      await loadCashTickets()\n    } catch (requestError) {\n      setError(requestError.response?.data?.message || requestError.message || 'Unable to delete remittance.')\n    } finally {\n      setSaving('')\n    }\n  }\n"""
if "const deleteCollection = async (row)" not in text:
    if close_block not in text:
        raise SystemExit("closeCollectionDialog block not found")
    text = text.replace(close_block, close_block + handlers, 1)

old_cell = """                      <TableCell align=\"right\" sx={cellSx}>\n                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>\n                          <Button onClick={() => setViewingCollection(row)} size=\"small\" startIcon={<Eye size={14} />} sx={buttonSx} variant=\"outlined\">View</Button>\n                          <Button onClick={() => openEditCollection(row)} size=\"small\" startIcon={<Pencil size={14} />} sx={buttonSx} variant=\"outlined\">Edit</Button>\n                        </Box>\n                      </TableCell>\n"""
new_cell = """                      <TableCell align=\"right\" sx={cellSx}>\n                        <Button\n                          disabled={Boolean(saving)}\n                          endIcon={<MoreVertical size={14} />}\n                          onClick={(event) => openCollectionActionMenu(event, row)}\n                          size=\"small\"\n                          sx={buttonSx}\n                          variant=\"outlined\"\n                        >\n                          Actions\n                        </Button>\n                      </TableCell>\n"""
if old_cell in text:
    text = text.replace(old_cell, new_cell, 1)
elif "openCollectionActionMenu(event, row)" not in text:
    raise SystemExit("old action cell not found")

insert_before = """      <Dialog fullWidth maxWidth=\"sm\" onClose={closeCollectionDialog} open={collectionDialogOpen}>\n"""
menu_block = """      <Menu anchorEl={collectionActionAnchor} onClose={closeCollectionActionMenu} open={Boolean(collectionActionAnchor)}>\n        <MenuItem onClick={() => runCollectionAction((row) => setViewingCollection(row))}>\n          <Eye size={16} style={{ marginRight: 8 }} />\n          View\n        </MenuItem>\n        <MenuItem onClick={() => runCollectionAction(openEditCollection)}>\n          <Pencil size={16} style={{ marginRight: 8 }} />\n          Edit\n        </MenuItem>\n        <MenuItem onClick={() => runCollectionAction(deleteCollection)} sx={{ color: 'var(--color-danger-dark)' }}>\n          <Trash2 size={16} style={{ marginRight: 8 }} />\n          Delete\n        </MenuItem>\n      </Menu>\n\n"""
if "runCollectionAction(deleteCollection)" not in text:
    if insert_before not in text:
        raise SystemExit("dialog insertion point not found")
    text = text.replace(insert_before, menu_block + insert_before, 1)
frontend.write_text(text, encoding="utf-8")

php = controller.read_text(encoding="utf-8")
method_anchor = """    public function updateCollection(Request $request, CashTicketCollection $collection): JsonResponse\n    {\n        $data = $this->validateCollection($request);\n\n        DB::transaction(function () use ($request, $collection, $data) {\n            $collection->update($this->prepareCollectionData($request, $data, true));\n            $this->audit($request, $collection, 'collection.updated', $collection->fresh()->toArray());\n        });\n\n        return response()->json(['ok' => true, 'data' => $collection->fresh()->load('type:id,name,unit_value')]);\n    }\n\n"""
destroy_method = method_anchor + """    public function destroyCollection(Request $request, CashTicketCollection $collection): JsonResponse\n    {\n        DB::transaction(function () use ($request, $collection) {\n            $snapshot = $collection->toArray();\n            $this->audit($request, $collection, 'collection.deleted', $snapshot);\n            $collection->delete();\n        });\n\n        return response()->json(['ok' => true, 'message' => 'Cash ticket remittance deleted.']);\n    }\n\n"""
if "public function destroyCollection" not in php:
    if method_anchor not in php:
        raise SystemExit("updateCollection method anchor not found")
    php = php.replace(method_anchor, destroy_method, 1)
controller.write_text(php, encoding="utf-8")

route_text = routes.read_text(encoding="utf-8")
route_old = """            Route::post('/collections', [CashTicketController::class, 'storeCollection']);\n            Route::put('/collections/{collection}', [CashTicketController::class, 'updateCollection']);\n            Route::post('/report-rows', [CashTicketController::class, 'storeReportRow']);\n"""
route_new = """            Route::post('/collections', [CashTicketController::class, 'storeCollection']);\n            Route::put('/collections/{collection}', [CashTicketController::class, 'updateCollection']);\n            Route::delete('/collections/{collection}', [CashTicketController::class, 'destroyCollection']);\n            Route::post('/report-rows', [CashTicketController::class, 'storeReportRow']);\n"""
if "destroyCollection" not in route_text:
    if route_old not in route_text:
        raise SystemExit("collection route anchor not found")
    route_text = route_text.replace(route_old, route_new, 1)
routes.write_text(route_text, encoding="utf-8")

print("updated cash ticket collection action menu and delete support")
