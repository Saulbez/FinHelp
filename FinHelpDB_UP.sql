--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

-- Started on 2025-07-12 23:21:13

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
-- TOC entry 217 (class 1259 OID 24577)
-- Name: brands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.brands (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.brands OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 24580)
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
-- TOC entry 5047 (class 0 OID 0)
-- Dependencies: 218
-- Name: brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.brands_id_seq OWNED BY public.brands.id;


--
-- TOC entry 219 (class 1259 OID 24581)
-- Name: campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.campaigns (
    id integer NOT NULL,
    product_id integer,
    start_date date NOT NULL,
    end_date date NOT NULL,
    promo_price numeric(10,2) NOT NULL,
    campaign_profit_percent numeric(10,0) DEFAULT 0 NOT NULL,
    user_id integer NOT NULL
);


ALTER TABLE public.campaigns OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 24585)
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
-- TOC entry 5048 (class 0 OID 0)
-- Dependencies: 220
-- Name: campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.campaigns_id_seq OWNED BY public.campaigns.id;


--
-- TOC entry 241 (class 1259 OID 24791)
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    user_id integer
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 24790)
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categories_id_seq OWNER TO postgres;

--
-- TOC entry 5049 (class 0 OID 0)
-- Dependencies: 240
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- TOC entry 221 (class 1259 OID 24586)
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(20),
    debt numeric(10,2) DEFAULT 0,
    last_purchase character varying(45),
    user_id integer NOT NULL,
    last_purchase_date date,
    created_date timestamp(6) with time zone DEFAULT to_timestamp((19701010)::double precision) NOT NULL
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 24590)
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
-- TOC entry 5050 (class 0 OID 0)
-- Dependencies: 222
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- TOC entry 239 (class 1259 OID 24780)
-- Name: daily_sales_stats; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_sales_stats (
    date date NOT NULL,
    total_sales integer,
    total_revenue numeric(10,2),
    average_ticket numeric(10,2),
    user_id integer
);


ALTER TABLE public.daily_sales_stats OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 24591)
-- Name: installments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.installments (
    id integer NOT NULL,
    sale_payments_id integer,
    number integer NOT NULL,
    value numeric(10,2) NOT NULL,
    due_date date NOT NULL,
    paid boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    user_id integer NOT NULL,
    paid_date timestamp with time zone DEFAULT to_timestamp((19701010)::double precision) NOT NULL
);


ALTER TABLE public.installments OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 24596)
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
-- TOC entry 5051 (class 0 OID 0)
-- Dependencies: 224
-- Name: installments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.installments_id_seq OWNED BY public.installments.id;


--
-- TOC entry 225 (class 1259 OID 24597)
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
-- TOC entry 226 (class 1259 OID 24601)
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
-- TOC entry 5052 (class 0 OID 0)
-- Dependencies: 226
-- Name: payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_methods_id_seq OWNED BY public.payment_methods.id;


--
-- TOC entry 227 (class 1259 OID 24602)
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
    user_id integer NOT NULL,
    category character varying(55) DEFAULT 'Geral'::character varying NOT NULL,
    created_date timestamp(6) with time zone DEFAULT to_timestamp((19701010)::double precision) NOT NULL,
    category_id integer
);


ALTER TABLE public.products OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 24606)
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
-- TOC entry 5053 (class 0 OID 0)
-- Dependencies: 228
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- TOC entry 231 (class 1259 OID 24612)
-- Name: sale_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_payments (
    id integer NOT NULL,
    payment_method_id integer NOT NULL,
    sale_id integer NOT NULL,
    amount double precision NOT NULL,
    interest double precision,
    installments integer,
    user_id integer NOT NULL
);


ALTER TABLE public.sale_payments OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 24615)
-- Name: sale_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sale_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sale_payments_id_seq OWNER TO postgres;

--
-- TOC entry 5054 (class 0 OID 0)
-- Dependencies: 232
-- Name: sale_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sale_payments_id_seq OWNED BY public.sale_payments.id;


--
-- TOC entry 233 (class 1259 OID 24616)
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
-- TOC entry 229 (class 1259 OID 24607)
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
-- TOC entry 230 (class 1259 OID 24611)
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
-- TOC entry 5055 (class 0 OID 0)
-- Dependencies: 230
-- Name: sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sales_id_seq OWNED BY public.sales.id;


--
-- TOC entry 234 (class 1259 OID 24620)
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 24625)
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
-- TOC entry 236 (class 1259 OID 24631)
-- Name: users_old; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users_old (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(100) NOT NULL
);


ALTER TABLE public.users_old OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 24634)
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
-- TOC entry 5056 (class 0 OID 0)
-- Dependencies: 237
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users_old.id;


--
-- TOC entry 238 (class 1259 OID 24635)
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
-- TOC entry 5057 (class 0 OID 0)
-- Dependencies: 238
-- Name: users_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq1 OWNED BY public.users.id;


--
-- TOC entry 4804 (class 2604 OID 24636)
-- Name: brands id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);


--
-- TOC entry 4805 (class 2604 OID 24637)
-- Name: campaigns id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns ALTER COLUMN id SET DEFAULT nextval('public.campaigns_id_seq'::regclass);


--
-- TOC entry 4827 (class 2604 OID 24794)
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- TOC entry 4807 (class 2604 OID 24638)
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- TOC entry 4810 (class 2604 OID 24639)
-- Name: installments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installments ALTER COLUMN id SET DEFAULT nextval('public.installments_id_seq'::regclass);


--
-- TOC entry 4814 (class 2604 OID 24640)
-- Name: payment_methods id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN id SET DEFAULT nextval('public.payment_methods_id_seq'::regclass);


--
-- TOC entry 4816 (class 2604 OID 24641)
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- TOC entry 4822 (class 2604 OID 24643)
-- Name: sale_payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_payments ALTER COLUMN id SET DEFAULT nextval('public.sale_payments_id_seq'::regclass);


--
-- TOC entry 4820 (class 2604 OID 24642)
-- Name: sales id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales ALTER COLUMN id SET DEFAULT nextval('public.sales_id_seq'::regclass);


--
-- TOC entry 4824 (class 2604 OID 24644)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq1'::regclass);


--
-- TOC entry 4826 (class 2604 OID 24645)
-- Name: users_old id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_old ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4829 (class 2606 OID 24647)
-- Name: brands brands_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_name_key UNIQUE (name);


--
-- TOC entry 4831 (class 2606 OID 24649)
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- TOC entry 4834 (class 2606 OID 24651)
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- TOC entry 4876 (class 2606 OID 24796)
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- TOC entry 4837 (class 2606 OID 24653)
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- TOC entry 4874 (class 2606 OID 24784)
-- Name: daily_sales_stats daily_sales_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_sales_stats
    ADD CONSTRAINT daily_sales_stats_pkey PRIMARY KEY (date);


--
-- TOC entry 4842 (class 2606 OID 24655)
-- Name: installments installments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT installments_pkey PRIMARY KEY (id);


--
-- TOC entry 4845 (class 2606 OID 24657)
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- TOC entry 4849 (class 2606 OID 24659)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 4856 (class 2606 OID 24661)
-- Name: sale_payments sale_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_payments
    ADD CONSTRAINT sale_payments_pkey PRIMARY KEY (id);


--
-- TOC entry 4859 (class 2606 OID 24663)
-- Name: sale_products sale_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT sale_products_pkey PRIMARY KEY (sale_id, product_id);


--
-- TOC entry 4853 (class 2606 OID 24665)
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- TOC entry 4862 (class 2606 OID 24667)
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- TOC entry 4864 (class 2606 OID 24669)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4870 (class 2606 OID 24671)
-- Name: users_old users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_old
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4866 (class 2606 OID 24673)
-- Name: users users_pkey1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey1 PRIMARY KEY (id);


--
-- TOC entry 4872 (class 2606 OID 24675)
-- Name: users_old users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users_old
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4868 (class 2606 OID 24677)
-- Name: users users_username_key1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key1 UNIQUE (username);


--
-- TOC entry 4860 (class 1259 OID 24678)
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- TOC entry 4832 (class 1259 OID 24679)
-- Name: idx_brands_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_brands_user ON public.brands USING btree (user_id);


--
-- TOC entry 4835 (class 1259 OID 24680)
-- Name: idx_campaigns_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_campaigns_user ON public.campaigns USING btree (user_id);


--
-- TOC entry 4838 (class 1259 OID 24681)
-- Name: idx_clients_debt; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_debt ON public.clients USING btree (debt);


--
-- TOC entry 4839 (class 1259 OID 24682)
-- Name: idx_clients_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_clients_user ON public.clients USING btree (user_id);


--
-- TOC entry 4840 (class 1259 OID 24683)
-- Name: idx_installments_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_installments_user ON public.installments USING btree (user_id);


--
-- TOC entry 4843 (class 1259 OID 24684)
-- Name: idx_payment_methods_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_methods_user ON public.payment_methods USING btree (user_id);


--
-- TOC entry 4846 (class 1259 OID 24686)
-- Name: idx_products_brand; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_brand ON public.products USING btree (brand);


--
-- TOC entry 4847 (class 1259 OID 24685)
-- Name: idx_products_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_user ON public.products USING btree (user_id);


--
-- TOC entry 4854 (class 1259 OID 24689)
-- Name: idx_sale_payments_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sale_payments_user ON public.sale_payments USING btree (user_id);


--
-- TOC entry 4857 (class 1259 OID 24690)
-- Name: idx_sale_products_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sale_products_user ON public.sale_products USING btree (user_id);


--
-- TOC entry 4850 (class 1259 OID 24688)
-- Name: idx_sales_client; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_client ON public.sales USING btree (client_id);


--
-- TOC entry 4851 (class 1259 OID 24687)
-- Name: idx_sales_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_user ON public.sales USING btree (user_id);


--
-- TOC entry 4896 (class 2606 OID 24797)
-- Name: categories categories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4895 (class 2606 OID 24785)
-- Name: daily_sales_stats daily_sales_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_sales_stats
    ADD CONSTRAINT daily_sales_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4877 (class 2606 OID 24691)
-- Name: brands fk_brands_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT fk_brands_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4878 (class 2606 OID 24696)
-- Name: campaigns fk_campaigns_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT fk_campaigns_product FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 4879 (class 2606 OID 24701)
-- Name: campaigns fk_campaigns_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT fk_campaigns_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4880 (class 2606 OID 24706)
-- Name: clients fk_clients_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT fk_clients_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4881 (class 2606 OID 24711)
-- Name: installments fk_installments_payment_method; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT fk_installments_payment_method FOREIGN KEY (sale_payments_id) REFERENCES public.payment_methods(id);


--
-- TOC entry 4882 (class 2606 OID 24716)
-- Name: installments fk_installments_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.installments
    ADD CONSTRAINT fk_installments_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4883 (class 2606 OID 24721)
-- Name: payment_methods fk_payment_methods_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT fk_payment_methods_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4884 (class 2606 OID 24726)
-- Name: products fk_products_brand; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_products_brand FOREIGN KEY (brand) REFERENCES public.brands(id);


--
-- TOC entry 4885 (class 2606 OID 24731)
-- Name: products fk_products_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_products_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4889 (class 2606 OID 24736)
-- Name: sale_payments fk_sale_payments_method; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_payments
    ADD CONSTRAINT fk_sale_payments_method FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id);


--
-- TOC entry 4890 (class 2606 OID 24741)
-- Name: sale_payments fk_sale_payments_sale; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_payments
    ADD CONSTRAINT fk_sale_payments_sale FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- TOC entry 4891 (class 2606 OID 24746)
-- Name: sale_payments fk_sale_payments_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_payments
    ADD CONSTRAINT fk_sale_payments_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4892 (class 2606 OID 24751)
-- Name: sale_products fk_sale_products_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT fk_sale_products_product FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 4893 (class 2606 OID 24756)
-- Name: sale_products fk_sale_products_sale; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT fk_sale_products_sale FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- TOC entry 4894 (class 2606 OID 24761)
-- Name: sale_products fk_sale_products_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT fk_sale_products_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4887 (class 2606 OID 24766)
-- Name: sales fk_sales_client; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT fk_sales_client FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- TOC entry 4888 (class 2606 OID 24771)
-- Name: sales fk_sales_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT fk_sales_user FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4886 (class 2606 OID 24802)
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


-- Completed on 2025-07-12 23:21:13

--
-- PostgreSQL database dump complete
--

