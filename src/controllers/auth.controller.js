/* eslint-disable import/extensions */
/* eslint-disable no-underscore-dangle */
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { db } from '../database/db.js';
import { newUserSchema, loginSchema } from '../schemas/userSchemas.js';

async function registerUser(req, res) {
  const { name, email, password } = req.body;
  const encryptedPassword = bcrypt.hashSync(password, 10);
  const validation = newUserSchema.validate(
    { name, email, password },
    { abortEarly: false }
  );
  const hasThisEmail = await db.collection('users').findOne({ email });

  if (hasThisEmail) {
    return res
      .status(409)
      .send('Já existe um usuário com esse e-mail.\nInsira um e-mail válido');
  }

  if (validation.error) {
    const errors = validation.error.details
      .map((error) => error.message)
      .join('\n');
    return res.status(400).send(errors);
  }

  try {
    await db.collection('users').insertOne({
      name,
      email,
      password: encryptedPassword,
    });
    return res.send(201);
  } catch (error) {
    return console.log(error.message);
  }
}

async function loginUser(req, res) {
  const { email, password } = req.body;
  const token = uuid();
  const validation = loginSchema.validate({ email, password });

  if (validation.error) {
    return res
      .status(400)
      .send(
        'Formato inválido de dados. O e-mail deve ter formato de email (xxx@xxx.xxx) e a senha não pode ser vazia'
      );
  }

  try {
    const user = await db.collection('users').findOne({ email });
    const passwordIsValid = bcrypt.compareSync(
      password,
      user ? user.password : ' '
    );

    if (!user || !passwordIsValid) {
      return res
        .status(401)
        .send('Usuário ou senha inválidos. Revise seus dados.');
    }

    await db.collection('sessions').insertOne({
      userId: user._id,
      token,
      timestamp: Date.now(),
    });

    return res.status(201).send(token);
  } catch (error) {
    return res.status(401).send(error.message);
  }
}

async function authenticateToken(req, res) {
  const auth = req.headers;
  const token = auth.authorization?.replace('Bearer ', '');

  if (!token || token === 'Bearer') {
    return res
      .status(401)
      .send(
        'Você não tem autorização para acessar essa página.\nPor gentileza, faça o login.'
      );
  }

  try {
    const authUser = await db.collection('sessions').findOne({ token });
    if (!authUser) {
      return res
        .status(401)
        .send(
          'O seu acesso à página está expirado.\nPor gentileza, refaça o login.'
        );
    }
    const loggedUser = await db
      .collection('users')
      .findOne({ _id: authUser.userId });

    delete loggedUser.password;
    return res.status(200).send(loggedUser);
  } catch (error) {
    return res.status(400).send(error.message);
  }
}

export { registerUser, loginUser, authenticateToken };