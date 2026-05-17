import { useMemo, useState } from 'react';
import { Link2, Network, Plus, Trash2 } from 'lucide-react';
import EmptyState from './EmptyState.jsx';
import {
  RELATION_TYPES,
  createId,
  getRelationTypeLabel,
  normalizeRelations,
} from '../utils/library.js';

function buildGraph(records) {
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const edges = records.flatMap((record) =>
    normalizeRelations(record.relations).map((relation) => ({
      ...relation,
      sourceId: record.id,
      sourceTitle: record.title,
      targetTitle: recordMap.get(relation.targetId)?.title || '',
    })),
  ).filter((edge) => recordMap.has(edge.targetId));

  const relatedIds = new Set();
  edges.forEach((edge) => {
    relatedIds.add(edge.sourceId);
    relatedIds.add(edge.targetId);
  });

  const nodes = records.filter((record) => relatedIds.has(record.id));
  return { nodes, edges };
}

function getNodePositions(nodes) {
  const centerX = 450;
  const centerY = 270;
  const radiusX = nodes.length <= 2 ? 210 : 315;
  const radiusY = nodes.length <= 2 ? 0 : 185;

  return new Map(
    nodes.map((node, index) => {
      const angle = nodes.length <= 2 ? index * Math.PI : (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
      return [
        node.id,
        {
          x: centerX + Math.cos(angle) * radiusX,
          y: centerY + Math.sin(angle) * radiusY,
        },
      ];
    }),
  );
}

export default function RelationGraphPanel({ records, onUpdateRecord }) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [relationType, setRelationType] = useState('series');
  const [note, setNote] = useState('');

  const activeSourceId = sourceId || records[0]?.id || '';
  const targetOptions = useMemo(
    () => records.filter((record) => record.id !== activeSourceId),
    [activeSourceId, records],
  );
  const activeTargetId = targetId && targetOptions.some((record) => record.id === targetId)
    ? targetId
    : targetOptions[0]?.id || '';
  const graph = useMemo(() => buildGraph(records), [records]);
  const positions = useMemo(() => getNodePositions(graph.nodes), [graph.nodes]);

  const handleAddRelation = (event) => {
    event.preventDefault();
    const source = records.find((record) => record.id === activeSourceId);
    if (!source || !activeTargetId || source.id === activeTargetId) return;

    const exists = normalizeRelations(source.relations).some(
      (relation) => relation.targetId === activeTargetId && relation.type === relationType,
    );
    if (exists) return;

    onUpdateRecord(source.id, {
      relations: normalizeRelations([
        ...(source.relations || []),
        {
          id: createId(),
          targetId: activeTargetId,
          type: relationType,
          note,
        },
      ]),
    });
    setNote('');
  };

  const handleDeleteRelation = (sourceRecordId, relationId) => {
    const source = records.find((record) => record.id === sourceRecordId);
    if (!source) return;
    onUpdateRecord(source.id, {
      relations: normalizeRelations((source.relations || []).filter((relation) => relation.id !== relationId)),
    });
  };

  return (
    <section className="panel" aria-labelledby="graph-title">
      <div className="section-heading split">
        <div>
          <p className="eyebrow">关系图谱</p>
          <h2 id="graph-title">建立系列、世界观、作者/会社和改编关系</h2>
        </div>
        <div className="result-count">{graph.edges.length} 条关系</div>
      </div>

      {records.length < 2 && (
        <EmptyState title="至少需要两部作品" description="先在我的库中加入更多作品，再建立作品之间的关系。" />
      )}

      {records.length >= 2 && (
        <>
          <form className="relation-form" onSubmit={handleAddRelation}>
            <label>
              <span>源作品</span>
              <select value={activeSourceId} onChange={(event) => setSourceId(event.target.value)}>
                {records.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>关系类型</span>
              <select value={relationType} onChange={(event) => setRelationType(event.target.value)}>
                {RELATION_TYPES.map((relation) => (
                  <option key={relation.value} value={relation.value}>
                    {relation.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>目标作品</span>
              <select value={activeTargetId} onChange={(event) => setTargetId(event.target.value)}>
                {targetOptions.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>备注</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="例如 原作小说改编 / 同会社企划"
              />
            </label>

            <button className="button primary" type="submit">
              <Plus size={16} />
              <span>添加关系</span>
            </button>
          </form>

          {graph.edges.length === 0 ? (
            <EmptyState title="关系图谱等待第一条边" description="上方选择两部作品并添加关系后，节点图会自动生成。" />
          ) : (
            <div className="graph-layout">
              <div className="graph-canvas" aria-label="作品关系节点图">
                <svg viewBox="0 0 900 540" role="img" aria-labelledby="graph-svg-title">
                  <title id="graph-svg-title">作品关系图谱</title>
                  <defs>
                    <marker
                      id="arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" />
                    </marker>
                  </defs>
                  {graph.edges.map((edge) => {
                    const start = positions.get(edge.sourceId);
                    const end = positions.get(edge.targetId);
                    if (!start || !end) return null;
                    const midX = (start.x + end.x) / 2;
                    const midY = (start.y + end.y) / 2;
                    return (
                      <g className="graph-edge" key={edge.id}>
                        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerEnd="url(#arrow)" />
                        <text x={midX} y={midY - 8} textAnchor="middle">
                          {getRelationTypeLabel(edge.type)}
                        </text>
                      </g>
                    );
                  })}
                  {graph.nodes.map((node) => {
                    const position = positions.get(node.id);
                    return (
                      <g className="graph-node" key={node.id} transform={`translate(${position.x}, ${position.y})`}>
                        <circle r="42" />
                        <text textAnchor="middle" y="-4">
                          {node.title.slice(0, 10)}
                        </text>
                        <text className="graph-node-type" textAnchor="middle" y="15">
                          {node.type.slice(0, 12)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="relation-list" aria-label="关系列表">
                {graph.edges.map((edge) => (
                  <article className="relation-item" key={edge.id}>
                    <div>
                      <p className="eyebrow">{getRelationTypeLabel(edge.type)}</p>
                      <h3>
                        {edge.sourceTitle} <Link2 size={15} /> {edge.targetTitle}
                      </h3>
                      {edge.note && <p>{edge.note}</p>}
                    </div>
                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={() => handleDeleteRelation(edge.sourceId, edge.id)}
                      aria-label={`删除 ${edge.sourceTitle} 到 ${edge.targetTitle} 的关系`}
                      title="删除关系"
                    >
                      <Trash2 size={17} />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
