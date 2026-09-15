const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const TICKET_COUNT = 400;
const CUSTOMER_COUNT = 20;
const SEED_WINDOW_DAYS = 60;

const SLA_HOURS = { LOW: 72, MEDIUM: 48, HIGH: 24, CRITICAL: 8 };
const PRIORITY_WEIGHTS = [
  ['LOW', 30],
  ['MEDIUM', 35],
  ['HIGH', 25],
  ['CRITICAL', 10],
];
const CATEGORIES = ['BILLING', 'TECHNICAL_SUPPORT', 'ACCESS', 'OTHER'];
const CHANNELS = ['WEB', 'EMAIL', 'PHONE', 'MANUAL'];
const STATUS_TERMINAL_WEIGHTS = [
  ['OPEN', 15],
  ['IN_PROGRESS', 25],
  ['PENDING_CUSTOMER', 10],
  ['RESOLVED', 20],
  ['CLOSED', 30],
];

const TITLES_BY_CATEGORY = {
  BILLING: [
    'Cobro duplicado en la factura',
    'No reconozco un cargo en mi cuenta',
    'Solicito factura con desglose de impuestos',
    'El descuento no se aplicó correctamente',
  ],
  TECHNICAL_SUPPORT: [
    'La aplicación se cierra al iniciar',
    'Error 500 al guardar cambios',
    'El reporte no carga los datos',
    'La sincronización falla intermitentemente',
  ],
  ACCESS: [
    'No puedo iniciar sesión en el sistema',
    'Necesito restablecer mi contraseña',
    'Mi cuenta aparece bloqueada',
    'Solicito acceso a un nuevo módulo',
  ],
  OTHER: [
    'Consulta general sobre el servicio',
    'Solicitud de mejora para el producto',
    'Duda sobre el proceso de renovación',
    'Comentario sobre la atención recibida',
  ],
};

const COMPANY_PREFIXES = [
  'Constructora',
  'Distribuidora',
  'Comercial',
  'Panadería',
  'Farmacia',
  'Ferretería',
  'Consultora',
  'Transportes',
  'Textiles',
  'Papelería',
];
const COMPANY_SUFFIXES = [
  'del Valle',
  'San José',
  'Andina',
  'del Norte',
  'La Esperanza',
  'El Progreso',
  'del Sur',
  'Central',
  'Los Robles',
  'La Colina',
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function weightedPick(pairs) {
  const total = pairs.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of pairs) {
    if (roll < weight) return value;
    roll -= weight;
  }
  return pairs[pairs.length - 1][0];
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function randomDateBetween(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function computeSlaDueAt(priority, from) {
  return addHours(from, SLA_HOURS[priority]);
}

function buildStatusPath(terminal) {
  switch (terminal) {
    case 'OPEN':
      return ['OPEN'];
    case 'IN_PROGRESS':
      return ['OPEN', 'IN_PROGRESS'];
    case 'PENDING_CUSTOMER':
      return ['OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER'];
    case 'RESOLVED':
      return Math.random() < 0.5
        ? ['OPEN', 'IN_PROGRESS', 'RESOLVED']
        : ['OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER', 'IN_PROGRESS', 'RESOLVED'];
    case 'CLOSED':
      return [...buildStatusPath('RESOLVED'), 'CLOSED'];
    default:
      return ['OPEN'];
  }
}

async function resetData() {
  await prisma.ticketComment.deleteMany();
  await prisma.ticketStatusHistory.deleteMany();
  await prisma.ticketAssignmentHistory.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.customer.deleteMany();
}

async function upsertUsers() {
  const saltRounds = 10;

  async function upsertUser(email, name, role, password) {
    const passwordHash = await bcrypt.hash(password, saltRounds);
    return prisma.user.upsert({
      where: { email },
      update: { name, role, status: 'ACTIVE' },
      create: { email, name, role, passwordHash, status: 'ACTIVE' },
    });
  }

  const admin = await upsertUser('admin@example.com', 'Admin Principal', 'ADMIN', 'Admin123!');
  const supervisor = await upsertUser(
    'supervisor@example.com',
    'Supervisora Uno',
    'SUPERVISOR',
    'Supervisor123!',
  );
  const agentDefs = [
    ['agent1@example.com', 'Agente Uno', 'Agent123!'],
    ['agent2@example.com', 'Agente Dos', 'Agent456!'],
    ['agent3@example.com', 'Agente Tres', 'Agent789!'],
    ['agent4@example.com', 'Agente Cuatro', 'Agent101!'],
    ['agent5@example.com', 'Agente Cinco', 'Agent112!'],
  ];
  const agents = [];
  for (const [email, name, password] of agentDefs) {
    agents.push(await upsertUser(email, name, 'AGENT', password));
  }

  return { admin, supervisor, agents };
}

function buildCustomers() {
  const customers = [];
  const usedNames = new Set();
  while (customers.length < CUSTOMER_COUNT) {
    const name = `${pick(COMPANY_PREFIXES)} ${pick(COMPANY_SUFFIXES)}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
    customers.push({
      id: crypto.randomUUID(),
      name,
      email: `contacto@${slug}.example.com`,
      company: name,
      createdAt: randomDateBetween(daysAgo(SEED_WINDOW_DAYS + 30), daysAgo(SEED_WINDOW_DAYS)),
    });
  }
  return customers;
}

function buildTicket({ customer, staffCreators, agents, admin, supervisor, sequence }) {
  const now = new Date();
  const createdAt = randomDateBetween(daysAgo(SEED_WINDOW_DAYS), now);
  const priority = weightedPick(PRIORITY_WEIGHTS);
  const category = pick(CATEGORIES);
  const channel = pick(CHANNELS);
  const createdBy = pick(staffCreators);
  const terminalGoal = weightedPick(STATUS_TERMINAL_WEIGHTS);
  const path = buildStatusPath(terminalGoal);

  // --- Assignment simulation ---
  const assignmentEvents = [];
  let currentAssignee = null;
  const wantsAssignment = terminalGoal !== 'OPEN' || Math.random() < 0.4;
  if (wantsAssignment) {
    const reassignRoll = Math.random();
    const numAssignments = reassignRoll < 0.6 ? 1 : reassignRoll < 0.85 ? 2 : randomInt(3, 5);
    let cursor = addMinutes(createdAt, randomInt(5, 600));
    for (let i = 0; i < numAssignments; i++) {
      if (cursor > now) break;
      let nextAgent = pick(agents);
      let guard = 0;
      while (nextAgent.id === currentAssignee && guard < 5) {
        nextAgent = pick(agents);
        guard += 1;
      }
      assignmentEvents.push({
        fromUserId: currentAssignee,
        toUserId: nextAgent.id,
        changedById: pick([admin, supervisor]).id,
        changedAt: cursor,
      });
      currentAssignee = nextAgent.id;
      cursor = addHours(cursor, randomInt(1, 72));
    }
  }

  // --- Status transition simulation, capped so nothing lands in the future ---
  const statusEvents = [];
  let prevStatus = 'OPEN';
  let cursor = addMinutes(createdAt, randomInt(10, 300));
  for (const nextStatus of path.slice(1)) {
    if (cursor > now) break;
    const actor =
      nextStatus === 'CLOSED' || (prevStatus === 'CLOSED' && nextStatus === 'IN_PROGRESS')
        ? admin
        : currentAssignee
          ? agents.find((a) => a.id === currentAssignee) ?? admin
          : admin;
    statusEvents.push({
      fromStatus: prevStatus,
      toStatus: nextStatus,
      changedById: actor.id,
      changedAt: cursor,
    });
    prevStatus = nextStatus;
    cursor = addHours(cursor, randomInt(2, 96));
  }

  const finalStatus = statusEvents.length ? statusEvents[statusEvents.length - 1].toStatus : 'OPEN';
  const closedAt =
    finalStatus === 'CLOSED' ? statusEvents[statusEvents.length - 1].changedAt : null;

  const touchTimestamps = [
    createdAt,
    ...statusEvents.map((e) => e.changedAt),
    ...assignmentEvents.map((e) => e.changedAt),
  ];
  const updatedAt = new Date(Math.max(...touchTimestamps.map((d) => d.getTime())));

  const slaBaseline = assignmentEvents.length
    ? assignmentEvents[assignmentEvents.length - 1].changedAt
    : createdAt;

  const ticket = {
    id: crypto.randomUUID(),
    sequence,
    folio: `TCK-${String(sequence).padStart(5, '0')}`,
    customerId: customer.id,
    title: pick(TITLES_BY_CATEGORY[category]),
    description:
      'Descripción generada por el script de datos semilla para pruebas de las consultas obligatorias.',
    status: finalStatus,
    priority,
    category,
    channel,
    assignedToId: currentAssignee,
    createdById: createdBy.id,
    createdAt,
    updatedAt,
    closedAt,
    slaDueAt: computeSlaDueAt(priority, slaBaseline),
    reassignmentCount: assignmentEvents.length,
  };

  const statusHistoryRows = statusEvents.map((e) => ({
    id: crypto.randomUUID(),
    ticketId: ticket.id,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    changedById: e.changedById,
    changedAt: e.changedAt,
  }));

  const assignmentHistoryRows = assignmentEvents.map((e) => ({
    id: crypto.randomUUID(),
    ticketId: ticket.id,
    fromUserId: e.fromUserId,
    toUserId: e.toUserId,
    changedById: e.changedById,
    changedAt: e.changedAt,
  }));

  return { ticket, statusHistoryRows, assignmentHistoryRows };
}

async function main() {
  console.log('Reiniciando datos de tickets/clientes...');
  await resetData();

  console.log('Creando usuarios (admin, supervisor, 5 agentes)...');
  const { admin, supervisor, agents } = await upsertUsers();
  const staffCreators = [admin, ...agents];

  console.log(`Creando ${CUSTOMER_COUNT} clientes...`);
  const customers = buildCustomers();
  await prisma.customer.createMany({ data: customers });

  console.log(`Generando ${TICKET_COUNT} tickets con historial simulado...`);
  const tickets = [];
  const statusHistory = [];
  const assignmentHistory = [];

  for (let i = 1; i <= TICKET_COUNT; i++) {
    const { ticket, statusHistoryRows, assignmentHistoryRows } = buildTicket({
      customer: pick(customers),
      staffCreators,
      agents,
      admin,
      supervisor,
      sequence: i,
    });
    tickets.push(ticket);
    statusHistory.push(...statusHistoryRows);
    assignmentHistory.push(...assignmentHistoryRows);
  }

  await prisma.ticket.createMany({ data: tickets });
  await prisma.ticketStatusHistory.createMany({ data: statusHistory });
  await prisma.ticketAssignmentHistory.createMany({ data: assignmentHistory });

  await prisma.$executeRawUnsafe(
    `SELECT setval('tickets_sequence_seq', (SELECT COALESCE(MAX(sequence), 0) FROM tickets))`,
  );

  const reassignedMoreThanTwo = tickets.filter((t) => t.reassignmentCount > 2).length;
  const closedCount = tickets.filter((t) => t.status === 'CLOSED').length;
  const resolvedCount = tickets.filter((t) => t.status === 'RESOLVED').length;

  console.log('Listo.');
  console.log(`  Tickets creados: ${tickets.length}`);
  console.log(`  Cerrados: ${closedCount} · Resueltos: ${resolvedCount}`);
  console.log(`  Reasignados más de 2 veces: ${reassignedMoreThanTwo}`);
  console.log('  Credenciales: admin@example.com / Admin123!');
  console.log('               supervisor@example.com / Supervisor123!');
  console.log('               agent1..5@example.com / Agent123! · Agent456! · Agent789! · Agent101! · Agent112!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
