const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const Post = require('../models/post');

module.exports = {
    createUser: async function ({ userInput }, req) {
        // const email = args.userInput.email;

        const errors = [];

        if (!validator.isEmail(userInput.email)) {
            errors.push({ message: 'email is invalid' });
        }

        if (validator.isEmpty(userInput.password) ||
            validator.isLength(userInput.password, { min: 5 })) {
            errors.push({ message: 'password is too short' });
        }

        if (errors.length > 0) {
            const error = new Error('invalid input');
            error.data = errors;
            error.code = 422;
            throw error;
        }

        const existingUser = await User.findOne({ email: userInput.email });

        if (existingUser) {
            const error = new Error('user exists already');
            throw error;
        }

        const hashedPw = await bcrypt.hash(userInput.password, 12);

        const user = new User({
            email: userInput.email,
            name: userInput.name,
            password: hashedPw
        });

        const createdUser = await user.save();

        return {
            ...createdUser._doc,
            _id: createdUser._id.toString()
        };
    },

    login: async function ({ email, password }) {
        const user = await User.findOne({ email: email });

        if (!user) {
            const error = new Error('no user found');
            error.code = 401;
            throw error;
        }

        const isEqual = await bcrypt.compare(password, user.password);

        if (!isEqual) {
            const error = new Error('wrong password');
            error.code = 401;
            throw error;
        }

        const token = jwt.sign(
            {
                userId: user._id.toString(),
                email: user.email
            },
            'secret789',
            { expiresIn: '1h' }
        );

        return {
            token: token,
            userId: user._id.toString()
        };
    },

    createPost: async function ({ postInput }, req) {
        if (!req) {
            throw new Error('there is no req');
        }

        if (!req.isAuth) {
            const error = new Error('not authenticated');
            error.code = 401;
            throw error;
        }

        const errors = [];

        if (validator.isEmpty(postInput.title) ||
            !validator.isLength(postInput.title, { min: 5 })) {
            errors.push({ message: 'title is invalid' });
        }

        if (validator.isEmpty(postInput.content) ||
            !validator.isLength(postInput.content, { min: 5 })) {
            errors.push({ message: 'content is invalid' });
        }

        if (errors.length > 0) {
            const error = new Error('invalid input');
            error.data = errors;
            error.code = 422;
            throw error;
        }

        const user = await User.findById(req.userId);

        if (!user) {
            const error = new Error('invalid user');
            error.code = 401;
            throw error;
        }

        const newPost = new Post({
            title: postInput.title,
            content: postInput.content,
            imageUrl: postInput.imageUrl,
            creator: user
        });

        const createdPost = await newPost.save();

        user.posts.push(createdPost);

        await user.save();

        return {
            ...createdPost._doc,
            _id: createdPost._id.toString(),
            createdAt: createdPost.createdAt.toISOString(),
            updatedAt: createdPost.updatedAt.toISOString()
        };
    }
}