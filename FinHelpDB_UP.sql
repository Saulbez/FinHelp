--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

-- Started on 2025-07-02 20:00:39

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 231 (class 1259 OID 24591)
-- Name: brands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.brands (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.brands OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 24590)
-- Name: brands_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.brands_id_seq OWNER TO postgres;

--
-- TOC entry 5042 (class 0 OID 0)
-- Dependencies: 230
-- Name: brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.brands_id_seq OWNED BY public.brands.id;


--
-- TOC entry 227 (class 1259 OID 16444)
-- Name: campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaigns (
    id integer NOT NULL,
    product_id integer,
    start_date date NOT NULL,
    end_date date NOT NULL,
    promo_price numeric(10,2) NOT NULL,
    campaing_profit_percent numeric(10,0) DEFAULT 0 NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.campaigns OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 16443)
-- Name: campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.campaigns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.campaigns_id_seq OWNER TO postgres;

--
-- TOC entry 5043 (class 0 OID 0)
-- Dependencies: 226
-- Name: campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.campaigns_id_seq OWNED BY public.campaigns.id;


--
-- TOC entry 220 (class 1259 OID 16398)
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(20),
    debt numeric(10,2) DEFAULT 0,
    last_purchase character varying(45),
    user_id integer NOT NULL,
    last_purchase_date date
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16397)
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.clients_id_seq OWNER TO postgres;

--
-- TOC entry 5044 (class 0 OID 0)
-- Dependencies: 219
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- TOC entry 233 (class 1259 OID 24614)
-- Name: installments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.installments (
    id integer NOT NULL,
    payment_method_id integer,
    number integer NOT NULL,
    value numeric(10,2) NOT NULL,
    due_date date NOT NULL,
    paid boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    user_id integer NOT NULL
);


ALTER TABLE public.installments OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 24613)
-- Name: installments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.installments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.installments_id_seq OWNER TO postgres;

--
-- TOC entry 5045 (class 0 OID 0)
-- Dependencies: 232
-- Name: installments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.installments_id_seq OWNED BY public.installments.id;


--
-- TOC entry 229 (class 1259 OID 24577)
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_methods (
    id integer NOT NULL,
    method character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    user_id integer NOT NULL
);


ALTER TABLE public.payment_methods OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 24576)
-- Name: payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_methods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_methods_id_seq OWNER TO postgres;

--
-- TOC entry 5046 (class 0 OID 0)
-- Dependencies: 228
-- Name: payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_methods_id_seq OWNED BY public.payment_methods.id;


--
-- TOC entry 222 (class 1259 OID 16406)
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    brand integer,
    price numeric(10,2) NOT NULL,
    stock integer NOT NULL,
    image character varying(255),
    current_campaign_id integer,
    profit_percent numeric(10,0) DEFAULT 0 NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.products OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16405)
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO postgres;

--
-- TOC entry 5047 (class 0 OID 0)
-- Dependencies: 221
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- TOC entry 224 (class 1259 OID 16414)
-- Name: sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales (
    id integer NOT NULL,
    client_id integer,
    total numeric(10,2) NOT NULL,
    payment_method character varying(50),
    sale_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer NOT NULL,
    interest double precision,
    installments integer
);


ALTER TABLE public.sales OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16413)
-- Name: sales_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sales_id_seq OWNER TO postgres;

--
-- TOC entry 5048 (class 0 OID 0)
-- Dependencies: 223
-- Name: sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sales_id_seq OWNED BY public.sales.id;


--
-- TOC entry 237 (class 1259 OID 49158)
-- Name: sale_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_payments (
    id integer DEFAULT nextval('public.sales_id_seq'::regclass) NOT NULL,
    payment_method_id integer NOT NULL,
    sale_id integer NOT NULL,
    amount double precision NOT NULL,
    interest double precision,
    installments integer,
    user_id integer NOT NULL
);


ALTER TABLE public.sale_payments OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16426)
-- Name: sale_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_products (
    sale_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) DEFAULT 0 NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.sale_products OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 40980)
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 40967)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16389)
-- Name: users_old; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users_old (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(100) NOT NULL
);


ALTER TABLE public.users_old OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 16388)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5049 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users_old.id;


--
-- TOC entry 234 (class 1259 OID 40966)
-- Name: users_id_seq1; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq1 OWNER TO postgres;

--
-- TOC entry 5050 (class 0 OID 0)
-- Dependencies: 234
-- Name: users_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq1 OWNED BY public.users.id;


--
-- TOC entry 4806 (class 2604 OID 24594)
-- Name: brands id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);


--
-- TOC entry 4802 (class 2604 OID 16447)
-- Name: campaigns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns ALTER COLUMN id SET DEFAULT nextval('public.campaigns_id_seq'::regclass);


--
-- TOC entry 4795 (class 2604 OID 16401)
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- TOC entry 4807 (class 2604 OID 24617)
-- Name: installments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installments ALTER COLUMN id SET DEFAULT nextval('public.installments_id_seq'::regclass);


--
-- TOC entry 4804 (class 2604 OID 24580)
-- Name: payment_methods id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN id SET DEFAULT nextval('public.payment_methods_id_seq'::regclass);


--
-- TOC entry 4797 (class 2604 OID 16409)
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- TOC entry 4799 (class 2604 OID 16417)
-- Name: sales id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales ALTER COLUMN id SET DEFAULT nextval('public.sales_id_seq'::regclass);


--
-- TOC entry 4810 (class 2604 OID 40970)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq1'::regclass);


--
-- TOC entry 4794 (class 2604 OID 16392)
-- Name: users_old id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_old ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5030 (class 0 OID 24591)
-- Dependencies: 231
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.brands (id, name, user_id) FROM stdin;
1	boticario	1
2	avon	1
3	Marca X	1
\.


--
-- TOC entry 5026 (class 0 OID 16444)
-- Dependencies: 227
-- Data for Name: campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.campaigns (id, product_id, start_date, end_date, promo_price, campaing_profit_percent, user_id) FROM stdin;
\.


--
-- TOC entry 5019 (class 0 OID 16398)
-- Dependencies: 220
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients (id, name, phone, debt, last_purchase, user_id, last_purchase_date) FROM stdin;
3	Márcia Almeida	85999999999	0.00	\N	1	\N
2	Cláudia Cristina	85985292421	0.00	42	1	2025-06-14
1	Saul Bezerra	(85) 98579.7047	0.00	43	1	2025-07-02
\.


--
-- TOC entry 5032 (class 0 OID 24614)
-- Dependencies: 233
-- Data for Name: installments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.installments (id, payment_method_id, number, value, due_date, paid, created_at, user_id) FROM stdin;
\.


--
-- TOC entry 5028 (class 0 OID 24577)
-- Dependencies: 229
-- Data for Name: payment_methods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_methods (id, method, created_at, user_id) FROM stdin;
1	PIX	2025-07-02 00:00:00	1
2	CREDITO	2025-07-02 00:00:00	1
3	DEBITO	2025-07-02 00:00:00	1
4	PIX-CREDITO	2025-07-02 00:00:00	1
5	BOLETO	2025-07-02 00:00:00	1
\.


--
-- TOC entry 5021 (class 0 OID 16406)
-- Dependencies: 222
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, name, brand, price, stock, image, current_campaign_id, profit_percent, user_id) FROM stdin;
13	Quasar Vision	1	159.90	120	/images/products/7433f2d7-bfc6-4a0c-8466-9824ecda7230.jpg	\N	13	1
1	Perfume Kaiak man	1	149.90	49	images/products/kaiak.jpeg	\N	12	1
4	Essencial Supreme	2	249.90	21	/images/products/placeholder.png	\N	14	1
11	Creme Hidratante	1	54.90	21	/images/products/1f5307c5-d859-48d7-8890-c4182e518975.png	\N	7	1
6	Shampoo	3	25.90	10	\N	\N	9	1
\.


--
-- TOC entry 5036 (class 0 OID 49158)
-- Dependencies: 237
-- Data for Name: sale_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sale_payments (id, payment_method_id, sale_id, amount, interest, installments, user_id) FROM stdin;
\.


--
-- TOC entry 5024 (class 0 OID 16426)
-- Dependencies: 225
-- Data for Name: sale_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sale_products (sale_id, product_id, quantity, unit_price, user_id) FROM stdin;
\.


--
-- TOC entry 5023 (class 0 OID 16414)
-- Dependencies: 224
-- Data for Name: sales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales (id, client_id, total, payment_method, sale_date, user_id, interest, installments) FROM stdin;
\.


--
-- TOC entry 5035 (class 0 OID 40980)
-- Dependencies: 236
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session (sid, sess, expire) FROM stdin;
TbWr_jQ-dkiZamwLtVE1GUOpXZebiypz	{"cookie":{"originalMaxAge":86400000,"expires":"2025-07-03T20:06:37.926Z","httpOnly":true,"path":"/"},"userId":1}	2025-07-03 19:59:28
\.


--
-- TOC entry 5034 (class 0 OID 40967)
-- Dependencies: 235
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, email, password, created_at) FROM stdin;
1	Saul	saull2504@gmail.com	$2b$12$7XN6NeK8ujDLPe.Zw22kge0hPhIenfU5v1EIwhXYRFqJRVdtYbOlq	2025-05-28 17:21:59.157543
3	Leticia	leticiaemilebarrosolima@gmail.com	$2b$12$6.1CHLhr.xS2kTXgmViiwuoS1mVNbb98f2cTgCG0luA0h464xJoJe	2025-05-28 17:34:37.437579
\.


--
-- TOC entry 5017 (class 0 OID 16389)
-- Dependencies: 218
-- Data for Name: users_old; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users_old (id, username, password) FROM stdin;
\.


--
-- TOC entry 5051 (class 0 OID 0)
-- Dependencies: 230
-- Name: brands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.brands_id_seq', 3, true);


--
-- TOC entry 5052 (class 0 OID 0)
-- Dependencies: 226
-- Name: campaigns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.campaigns_id_seq', 3, true);


--
-- TOC entry 5053 (class 0 OID 0)
-- Dependencies: 219
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.clients_id_seq', 3, true);


--
-- TOC entry 5054 (class 0 OID 0)
-- Dependencies: 232
-- Name: installments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.installments_id_seq', 20, true);


--
-- TOC entry 5055 (class 0 OID 0)
-- Dependencies: 228
-- Name: payment_methods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_methods_id_seq', 36, true);


--
-- TOC entry 5056 (class 0 OID 0)
-- Dependencies: 221
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 13, true);


--
-- TOC entry 5057 (class 0 OID 0)
-- Dependencies: 223
-- Name: sales_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sales_id_seq', 44, true);


--
-- TOC entry 5058 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- TOC entry 5059 (class 0 OID 0)
-- Dependencies: 234
-- Name: users_id_seq1; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq1', 3, true);


--
-- TOC entry 4838 (class 2606 OID 24598)
-- Name: brands brands_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_name_key UNIQUE (name);


--
-- TOC entry 4840 (class 2606 OID 24596)
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- TOC entry 4832 (class 2606 OID 16449)
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- TOC entry 4818 (class 2606 OID 16404)
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- TOC entry 4844 (class 2606 OID 24621)
-- Name: installments installments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_pkey PRIMARY KEY (id);


--
-- TOC entry 4836 (class 2606 OID 24584)
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- TOC entry 4823 (class 2606 OID 16412)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 4855 (class 2606 OID 49163)
-- Name: sale_payments sale_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_payments
    ADD CONSTRAINT sale_payments_pkey PRIMARY KEY (id);


--
-- TOC entry 4830 (class 2606 OID 16430)
-- Name: sale_products sale_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT sale_products_pkey PRIMARY KEY (sale_id, product_id);


--
-- TOC entry 4827 (class 2606 OID 16420)
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- TOC entry 4853 (class 2606 OID 40986)
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- TOC entry 4846 (class 2606 OID 40979)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4814 (class 2606 OID 16394)
-- Name: users_old users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_old
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4848 (class 2606 OID 40975)
-- Name: users users_pkey1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey1 PRIMARY KEY (id);


--
-- TOC entry 4816 (class 2606 OID 16396)
-- Name: users_old users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_old
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4850 (class 2606 OID 40977)
-- Name: users users_username_key1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key1 UNIQUE (username);


--
-- TOC entry 4851 (class 1259 OID 40987)
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- TOC entry 4841 (class 1259 OID 41071)
-- Name: idx_brands_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_brands_user ON public.brands USING btree (user_id);


--
-- TOC entry 4833 (class 1259 OID 41056)
-- Name: idx_campaigns_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaigns_user ON public.campaigns USING btree (user_id);


--
-- TOC entry 4819 (class 1259 OID 16442)
-- Name: idx_clients_debt; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_debt ON public.clients USING btree (debt);


--
-- TOC entry 4820 (class 1259 OID 41054)
-- Name: idx_clients_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_user ON public.clients USING btree (user_id);


--
-- TOC entry 4842 (class 1259 OID 41060)
-- Name: idx_installments_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_installments_user ON public.installments USING btree (user_id);


--
-- TOC entry 4834 (class 1259 OID 41059)
-- Name: idx_paymentmtd_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_paymentmtd_user ON public.payment_methods USING btree (user_id);


--
-- TOC entry 4821 (class 1259 OID 41055)
-- Name: idx_products_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_user ON public.products USING btree (user_id);


--
-- TOC entry 4828 (class 1259 OID 41058)
-- Name: idx_saleprod_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_saleprod_user ON public.sale_products USING btree (user_id);


--
-- TOC entry 4824 (class 1259 OID 16441)
-- Name: idx_sales_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_date ON public.sales USING btree (sale_date);


--
-- TOC entry 4825 (class 1259 OID 41057)
-- Name: idx_sales_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_user ON public.sales USING btree (user_id);


--
-- TOC entry 4865 (class 2606 OID 16450)
-- Name: campaigns campaigns_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 4857 (class 2606 OID 24607)
-- Name: products fk_brand; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_brand FOREIGN KEY (brand) REFERENCES public.brands(id);


--
-- TOC entry 4868 (class 2606 OID 41066)
-- Name: brands fk_brands_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT fk_brands_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4866 (class 2606 OID 41025)
-- Name: campaigns fk_campaigns_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT fk_campaigns_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4856 (class 2606 OID 41013)
-- Name: clients fk_clients_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT fk_clients_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4869 (class 2606 OID 41049)
-- Name: installments fk_installments_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT fk_installments_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4867 (class 2606 OID 41043)
-- Name: payment_methods fk_payment_methods_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT fk_payment_methods_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4858 (class 2606 OID 41019)
-- Name: products fk_products_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_products_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4862 (class 2606 OID 41037)
-- Name: sale_products fk_sale_products_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT fk_sale_products_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4860 (class 2606 OID 41031)
-- Name: sales fk_sales_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT fk_sales_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4870 (class 2606 OID 24622)
-- Name: installments installments_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id);


--
-- TOC entry 4859 (class 2606 OID 16455)
-- Name: products products_current_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_current_campaign_id_fkey FOREIGN KEY (current_campaign_id) REFERENCES public.campaigns(id);


--
-- TOC entry 4863 (class 2606 OID 16436)
-- Name: sale_products sale_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT sale_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 4864 (class 2606 OID 16431)
-- Name: sale_products sale_products_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT sale_products_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- TOC entry 4861 (class 2606 OID 16421)
-- Name: sales sales_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


-- Completed on 2025-07-02 20:00:39

--
-- PostgreSQL database dump complete
--

