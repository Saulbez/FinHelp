--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

-- Started on 2025-04-28 20:19:10

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
    name character varying(50) NOT NULL
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
-- TOC entry 4998 (class 0 OID 0)
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
    campaing_profit_percent numeric(10,0) DEFAULT 0 NOT NULL
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
-- TOC entry 4999 (class 0 OID 0)
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
    last_purchase date
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
-- TOC entry 5000 (class 0 OID 0)
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
    created_at timestamp without time zone DEFAULT now()
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
-- TOC entry 5001 (class 0 OID 0)
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
    sale_id integer,
    method character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    interest numeric(5,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    installments integer DEFAULT 1
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
-- TOC entry 5002 (class 0 OID 0)
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
    profit_percent numeric(10,0) DEFAULT 0 NOT NULL
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
-- TOC entry 5003 (class 0 OID 0)
-- Dependencies: 221
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- TOC entry 225 (class 1259 OID 16426)
-- Name: sale_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_products (
    sale_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public.sale_products OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16414)
-- Name: sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales (
    id integer NOT NULL,
    client_id integer,
    total numeric(10,2) NOT NULL,
    payment_method character varying(50),
    sale_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
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
-- TOC entry 5004 (class 0 OID 0)
-- Dependencies: 223
-- Name: sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sales_id_seq OWNED BY public.sales.id;


--
-- TOC entry 218 (class 1259 OID 16389)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(100) NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

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
-- TOC entry 5005 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4795 (class 2604 OID 24594)
-- Name: brands id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);


--
-- TOC entry 4789 (class 2604 OID 16447)
-- Name: campaigns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns ALTER COLUMN id SET DEFAULT nextval('public.campaigns_id_seq'::regclass);


--
-- TOC entry 4782 (class 2604 OID 16401)
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- TOC entry 4796 (class 2604 OID 24617)
-- Name: installments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installments ALTER COLUMN id SET DEFAULT nextval('public.installments_id_seq'::regclass);


--
-- TOC entry 4791 (class 2604 OID 24580)
-- Name: payment_methods id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN id SET DEFAULT nextval('public.payment_methods_id_seq'::regclass);


--
-- TOC entry 4784 (class 2604 OID 16409)
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- TOC entry 4786 (class 2604 OID 16417)
-- Name: sales id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales ALTER COLUMN id SET DEFAULT nextval('public.sales_id_seq'::regclass);


--
-- TOC entry 4781 (class 2604 OID 16392)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4990 (class 0 OID 24591)
-- Dependencies: 231
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.brands (id, name) FROM stdin;
1	boticario
2	avon
3	Marca X
\.


--
-- TOC entry 4986 (class 0 OID 16444)
-- Dependencies: 227
-- Data for Name: campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.campaigns (id, product_id, start_date, end_date, promo_price, campaing_profit_percent) FROM stdin;
\.


--
-- TOC entry 4979 (class 0 OID 16398)
-- Dependencies: 220
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients (id, name, phone, debt, last_purchase) FROM stdin;
1	Saul Bezerra	(85) 98579.7047	0.00	\N
2	Cláudia Cristina	85985292421	0.00	\N
3	Márcia Almeida	85999999999	0.00	\N
\.


--
-- TOC entry 4992 (class 0 OID 24614)
-- Dependencies: 233
-- Data for Name: installments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.installments (id, payment_method_id, number, value, due_date, paid, created_at) FROM stdin;
1	20	1	222.89	2025-04-10	f	2025-03-09 23:22:23.742082
2	21	1	222.89	2025-04-10	f	2025-03-09 23:32:26.164296
3	22	1	132.89	2025-04-10	f	2025-03-09 23:34:38.448081
4	23	1	57.89	2025-04-21	f	2025-03-21 16:14:31.265268
5	24	1	222.89	2025-05-01	f	2025-04-01 14:13:02.629577
6	25	1	53.30	2025-05-28	f	2025-04-28 20:08:09.572396
7	25	2	53.30	2025-06-28	f	2025-04-28 20:08:09.572396
8	25	3	53.30	2025-07-28	f	2025-04-28 20:08:09.572396
\.


--
-- TOC entry 4988 (class 0 OID 24577)
-- Dependencies: 229
-- Data for Name: payment_methods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_methods (id, sale_id, method, amount, interest, created_at, installments) FROM stdin;
7	11	pix	249.90	2.99	2025-03-06 20:00:33.953565	1
8	12	pix	249.90	2.99	2025-03-06 20:06:15.67885	1
9	13	pix_credito	154.38	2.99	2025-03-06 20:06:27.759379	1
10	14	pix_credito	257.37	2.99	2025-03-06 20:08:09.593036	1
11	15	pix	249.90	2.99	2025-03-06 21:53:25.75004	1
18	19	pix_credito	152.89	2.99	2025-03-07 22:33:08.344571	1
19	19	credito	102.99	2.99	2025-03-07 22:33:08.344571	1
20	24	pix	219.90	2.99	2025-03-09 23:22:23.742082	1
21	25	pix	219.90	2.99	2025-03-09 23:32:26.164296	1
22	26	pix_credito	129.90	2.99	2025-03-09 23:34:38.448081	1
23	27	pix	54.90	2.99	2025-03-21 16:14:31.265268	1
24	28	pix	219.90	2.99	2025-04-01 14:13:02.629577	1
25	29	pix_credito	159.90	0.00	2025-04-28 20:08:09.572396	3
\.


--
-- TOC entry 4981 (class 0 OID 16406)
-- Dependencies: 222
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, name, brand, price, stock, image, current_campaign_id, profit_percent) FROM stdin;
1	Perfume Kaiak man	1	149.90	47	images/products/kaiak.jpeg	\N	12
6	Shampoo	3	25.90	10	\N	\N	9
11	Creme Hidratante	1	54.90	22	/images/products/1f5307c5-d859-48d7-8890-c4182e518975.png	\N	7
4	Essencial Supreme	2	249.90	14	/images/products/placeholder.png	\N	14
13	Quasar Vision	1	159.90	119	/images/products/7433f2d7-bfc6-4a0c-8466-9824ecda7230.jpg	\N	13
\.


--
-- TOC entry 4984 (class 0 OID 16426)
-- Dependencies: 225
-- Data for Name: sale_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sale_products (sale_id, product_id, quantity, unit_price) FROM stdin;
11	4	1	249.90
12	4	1	249.90
13	1	1	149.90
14	4	1	249.90
15	4	1	249.90
19	4	1	249.90
24	4	1	219.90
25	4	1	219.90
26	1	1	129.90
27	11	1	54.90
28	4	1	219.90
29	13	1	159.90
\.


--
-- TOC entry 4983 (class 0 OID 16414)
-- Dependencies: 224
-- Data for Name: sales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales (id, client_id, total, payment_method, sale_date) FROM stdin;
11	1	249.90	\N	2025-03-06 22:58:00
12	1	249.90	\N	2025-03-06 23:06:00
13	1	154.52	\N	2025-03-06 23:06:00
14	1	257.60	\N	2025-03-06 23:06:00
15	1	249.90	\N	2025-03-07 00:53:00
19	1	257.37	\N	2025-03-08 01:32:00
24	1	219.90	\N	2025-03-10 02:20:00
25	1	219.90	\N	2025-03-10 02:29:00
26	1	133.78	\N	2025-03-10 02:33:00
27	1	54.90	\N	2025-03-21 19:13:00
28	1	219.90	\N	2025-04-01 17:12:00
29	1	159.90	\N	2025-04-28 23:04:00
\.


--
-- TOC entry 4977 (class 0 OID 16389)
-- Dependencies: 218
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password) FROM stdin;
\.


--
-- TOC entry 5006 (class 0 OID 0)
-- Dependencies: 230
-- Name: brands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.brands_id_seq', 3, true);


--
-- TOC entry 5007 (class 0 OID 0)
-- Dependencies: 226
-- Name: campaigns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.campaigns_id_seq', 3, true);


--
-- TOC entry 5008 (class 0 OID 0)
-- Dependencies: 219
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.clients_id_seq', 3, true);


--
-- TOC entry 5009 (class 0 OID 0)
-- Dependencies: 232
-- Name: installments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.installments_id_seq', 8, true);


--
-- TOC entry 5010 (class 0 OID 0)
-- Dependencies: 228
-- Name: payment_methods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_methods_id_seq', 25, true);


--
-- TOC entry 5011 (class 0 OID 0)
-- Dependencies: 221
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_id_seq', 13, true);


--
-- TOC entry 5012 (class 0 OID 0)
-- Dependencies: 223
-- Name: sales_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sales_id_seq', 29, true);


--
-- TOC entry 5013 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- TOC entry 4818 (class 2606 OID 24598)
-- Name: brands brands_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_name_key UNIQUE (name);


--
-- TOC entry 4820 (class 2606 OID 24596)
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- TOC entry 4814 (class 2606 OID 16449)
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- TOC entry 4804 (class 2606 OID 16404)
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- TOC entry 4822 (class 2606 OID 24621)
-- Name: installments installments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_pkey PRIMARY KEY (id);


--
-- TOC entry 4816 (class 2606 OID 24584)
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- TOC entry 4807 (class 2606 OID 16412)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 4812 (class 2606 OID 16430)
-- Name: sale_products sale_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT sale_products_pkey PRIMARY KEY (sale_id, product_id);


--
-- TOC entry 4810 (class 2606 OID 16420)
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- TOC entry 4800 (class 2606 OID 16394)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4802 (class 2606 OID 16396)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4805 (class 1259 OID 16442)
-- Name: idx_clients_debt; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_debt ON public.clients USING btree (debt);


--
-- TOC entry 4808 (class 1259 OID 16441)
-- Name: idx_sales_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_date ON public.sales USING btree (sale_date);


--
-- TOC entry 4828 (class 2606 OID 16450)
-- Name: campaigns campaigns_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 4823 (class 2606 OID 24607)
-- Name: products fk_brand; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_brand FOREIGN KEY (brand) REFERENCES public.brands(id);


--
-- TOC entry 4830 (class 2606 OID 24622)
-- Name: installments installments_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id);


--
-- TOC entry 4829 (class 2606 OID 24585)
-- Name: payment_methods payment_methods_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- TOC entry 4824 (class 2606 OID 16455)
-- Name: products products_current_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_current_campaign_id_fkey FOREIGN KEY (current_campaign_id) REFERENCES public.campaigns(id);


--
-- TOC entry 4826 (class 2606 OID 16436)
-- Name: sale_products sale_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT sale_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 4827 (class 2606 OID 16431)
-- Name: sale_products sale_products_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT sale_products_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- TOC entry 4825 (class 2606 OID 16421)
-- Name: sales sales_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id);


-- Completed on 2025-04-28 20:19:11

--
-- PostgreSQL database dump complete
--

